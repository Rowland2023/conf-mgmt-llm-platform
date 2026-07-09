
import { z } from 'zod';
import { withSpan } from '@opentelemetry/api';
import { tracer } from '../observability/tracer.js';
import { AppError } from '../errors/AppError.js';

// All tool implementations must be idempotent
export class ToolExecutor {
  constructor({ uowFactory, domainServices, logger }) {
    this.uowFactory = uowFactory; // Unit of Work factory: gives you repo + outbox + tx
    this.domain = domainServices; // Pure domain services
    this.logger = logger;

    // Registry of all tools LLM can call. Maps to Application Use Cases.
    this.handlers = new Map([
      ['reschedule_slot', this.rescheduleSlot.bind(this)],
      ['enrich_speaker_bio', this.enrichSpeakerBio.bind(this)],
      ['draft_welcome_email', this.draftWelcomeEmail.bind(this)],
      ['cancel_booking', this.cancelBooking.bind(this)],
    ]);

    // Zod schemas here too for defense-in-depth. OpenAIClient validates first,
    // but we re-validate to prevent bypass if someone calls execute() directly.
    this.schemas = {
      reschedule_slot: z.object({
        conference_id: z.string().uuid(),
        slot_id: z.string().uuid(),
        new_start_time: z.string().datetime(),
        notify_speakers: z.boolean().default(true)
      }).strict(), //.strict() rejects extra fields from LLM

      enrich_speaker_bio: z.object({
        speaker_id: z.string().uuid(),
        linkedin_url: z.string().url()
      }).strict(),

      draft_welcome_email: z.object({
        booking_id: z.string().uuid()
      }).strict(),

      cancel_booking: z.object({
        booking_id: z.string().uuid(),
        reason: z.string().max(500)
      }).strict()
    };
  }

  /**
   * @param {string} toolName - From OpenAIClient.parseIntent
   * @param {object} payload - Already Zod-validated by OpenAIClient
   * @param {object} context - { tenantId, userId, idempotencyKey, traceId }
   * @returns {Promise<{result: any, events: DomainEvent[]}>}
   */
  async execute(toolName, payload, context) {
    return withSpan(tracer, `tool.${toolName}`, async (span) => {
      span.setAttributes({
        'llm.tool_name': toolName,
        'tenant.id': context.tenantId,
        'idempotency.key': context.idempotencyKey
      });

      // 1. Defense in depth: re-validate. Prevents direct calls from bypassing LLM layer.
      const schema = this.schemas[toolName];
      if (!schema) {
        throw new AppError('TOOL_NOT_FOUND', `No handler for ${toolName}`, 400);
      }

      const validated = schema.parse(payload); // Throws if LLM hallucinated extra fields

      // 2. Idempotency check: have we done this already?
      const uow = this.uowFactory.create();
      const existing = await uow.idempotencyRepo.find(context.idempotencyKey);
      if (existing) {
        this.logger.info('TOOL_IDEMPOTENT_SKIP', { toolName, key: context.idempotencyKey });
        span.setAttribute('idempotent', true);
        return existing.result; // Return cached result from previous run
      }

      // 3. Get handler and execute in transaction
      const handler = this.handlers.get(toolName);
      if (!handler) {
        throw new AppError('TOOL_NOT_IMPLEMENTED', toolName, 500);
      }

      try {
        const { result, events } = await uow.withTransaction(async () => {
          // All handlers MUST use the same UoW for atomicity
          return handler(validated, context, uow);
        });

        // 4. Store idempotency record on success
        await uow.idempotencyRepo.save({
          key: context.idempotencyKey,
          toolName,
          result,
          createdAt: new Date()
        });
        await uow.commit();

        span.setAttributes({ 'events.count': events.length });
        this.logger.info('TOOL_EXECUTED', { toolName, events: events.length });

        return { result, events };

      } catch (error) {
        await uow.rollback();
        span.recordException(error);
        this.logger.error('TOOL_EXECUTION_FAILED', {
          toolName,
          error: error.message,
          key: context.idempotencyKey
        });
        throw error;
      }
    });
  }

  // --- Tool Implementations: These are Application Use Cases ---

  async rescheduleSlot(dto, ctx, uow) {
    // 1. Load aggregate
    const conf = await uow.conferenceRepo.get(dto.conference_id, ctx.tenantId);
    if (!conf) throw new AppError('CONF_NOT_FOUND', '', 404);

    // 2. Execute domain logic. Throws if invariants fail.
    const events = conf.rescheduleSlot({
      slotId: dto.slot_id,
      newStart: new Date(dto.new_start_time),
      requestedBy: ctx.userId
    });

    // 3. Persist aggregate + outbox in same txn
    await uow.conferenceRepo.save(conf);
    for (const event of events) {
      await uow.outboxRepo.add(OutboxRecord.from(event, conf.id));
    }

    return {
      result: { slotId: dto.slot_id, status: 'rescheduled' },
      events
    };
  }

  async enrichSpeakerBio(dto, ctx, uow) {
    const speaker = await uow.speakerRepo.get(dto.speaker_id, ctx.tenantId);
    if (!speaker) throw new AppError('SPEAKER_NOT_FOUND', '', 404);

    // This is called by OutboxWorker AFTER LLM already generated the bio.
    // So dto here would contain { speaker_id, bio_text } not linkedin_url.
    // The LLM call happens in the worker, not here. This just saves.
    const events = speaker.updateBio(dto.bio_text, ctx.userId);

    await uow.speakerRepo.save(speaker);
    for (const event of events) {
      await uow.outboxRepo.add(OutboxRecord.from(event, speaker.id));
    }

    return { result: { speakerId: dto.speaker_id }, events };
  }

  async draftWelcomeEmail(dto, ctx, uow) {
    const booking = await uow.bookingRepo.get(dto.booking_id, ctx.tenantId);
    if (!booking) throw new AppError('BOOKING_NOT_FOUND', '', 404);

    // Generate email content. Could call another LLM here, or use template.
    // For idempotency: if email already sent, do nothing.
    if (booking.welcomeEmailSent) {
      return { result: { status: 'already_sent' }, events: [] };
    }

    const events = [new WelcomeEmailRequested(booking.id, booking.email)];
    await uow.outboxRepo.add(OutboxRecord.from(events[0], booking.id));

    return { result: { status: 'queued' }, events };
  }

  async cancelBooking(dto, ctx, uow) {
    const booking = await uow.bookingRepo.get(dto.booking_id, ctx.tenantId);
    if (!booking) throw new AppError('BOOKING_NOT_FOUND', '', 404);

    const events = booking.cancel(dto.reason, ctx.userId); // Domain checks: can it be cancelled?

    await uow.bookingRepo.save(booking);
    for (const event of events) {
      await uow.outboxRepo.add(OutboxRecord.from(event, booking.id));
    }

    return { result: { status: 'cancelled' }, events };
  }
}