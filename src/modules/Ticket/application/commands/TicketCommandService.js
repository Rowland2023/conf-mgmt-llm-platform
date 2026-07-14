// src/modules/ticket/application/services/TicketCommandService.js
import { Ticket } from '../../domain/entities/Ticket.js';
import { OptimisticLockError, DomainError } from '../../../shared/errors/index.js';
import { withRetry } from '../../../shared/utils/retry.js';

export class TicketCommandService {
  #ticketRepository;
  #conferenceRepository;
  #outboxRepository;
  #unitOfWork;
  #logger;

  constructor({ ticketRepository, conferenceRepository, outboxRepository, unitOfWork, logger }) {
    this.#ticketRepository = ticketRepository;
    this.#conferenceRepository = conferenceRepository;
    this.#outboxRepository = outboxRepository;
    this.#unitOfWork = unitOfWork;
    this.#logger = logger;
  }

  async reserveTicket({ ticketId, userId, quantity, correlationId, idempotencyKey }) {
    const log = this.#logger.child({ correlationId, ticketId, userId, operation: 'reserveTicket' });
    
    // Retry wrapper for optimistic lock conflicts
    return withRetry(async () => {
      // Execute ensures a FRESH transaction context is initialized on each retry attempt
      return this.#unitOfWork.execute(async (trx) => {
        // 1. Idempotency check
        const cached = await this.#ticketRepository.findByIdempotencyKey(idempotencyKey, trx);
        if (cached) {
          log.info({ idempotencyKey }, 'Idempotent request: returning cached ticket');
          return cached;
        }

        // 2. Load aggregate
        const ticket = await this.#ticketRepository.findById(ticketId, trx);
        if (!ticket) {
          throw new DomainError('TICKET_NOT_FOUND', `Ticket ${ticketId} not found`, 404);
        }

        // 3. Business rule validation
        try {
          // FIXED: Correctly pass userId to align with the domain entity signature
          ticket.reserve(quantity, userId, correlationId);
        } catch (err) {
          // Preserve the original domain error code if it exists
          throw new DomainError('INSUFFICIENT_CAPACITY', err.message, 409);
        }

        // 4. Persist atomically
        await this.#ticketRepository.save(ticket, trx); // Throws OptimisticLockError if version mismatch
        await this.#outboxRepository.store(ticket.pullEvents(), trx);
        await this.#ticketRepository.saveIdempotencyKey(idempotencyKey, ticket.id, trx);

        log.info({ 
          quantity, 
          availableAfter: ticket.available,
          version: ticket.version 
        }, 'Tickets reserved successfully');

        return ticket;
      });
    }, {
      retries: 3,
      onRetry: (err, attempt) => {
        if (err instanceof OptimisticLockError) {
          log.warn({ attempt, error: err.message }, 'Optimistic lock conflict, retrying with fresh transaction context');
          return true; // Retry
        }
        return false; // Don't retry business logic errors
      }
    });
  }
}