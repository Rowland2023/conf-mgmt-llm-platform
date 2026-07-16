// src/shared/infrastructure/outbox/OutboxWorker.js

/**
 * Transactional Outbox Worker.
 *
 * Responsibilities:
 * - Poll unpublished outbox records.
 * - Dispatch events through an OutboxDispatcher.
 * - Mark successful events.
 * - Retry failed events.
 *
 * The worker knows nothing about Kafka,
 * RabbitMQ or PostgreSQL internals.
 */
export class OutboxWorker {
  constructor({
    outboxRepository,
    dispatcher,
    logger = console,
    pollIntervalMs = 3000,
    batchSize = 100,
    maxRetries = 5
  }) {
    if (!outboxRepository) {
      throw new Error(
        "OutboxWorker requires an outboxRepository."
      );
    }

    if (!dispatcher) {
      throw new Error(
        "OutboxWorker requires a dispatcher."
      );
    }

    this.outboxRepository = outboxRepository;
    this.dispatcher = dispatcher;

    this.logger = logger;

    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;

    this.running = false;
    this.timer = null;
  }

  /**
   * Starts polling.
   */
  start() {
    if (this.running) {
      return;
    }

    this.running = true;

    this.logger.info?.(
      "[OutboxWorker] started."
    );

    this.#schedule();
  }

  /**
   * Stops polling gracefully.
   */
  async stop() {
    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.logger.info?.(
      "[OutboxWorker] stopped."
    );
  }

  /**
   * Poll loop.
   */
  async #schedule() {
    if (!this.running) {
      return;
    }

    try {
      await this.#processBatch();
    } catch (error) {
      this.logger.error?.(
        "[OutboxWorker]",
        error
      );
    }

    this.timer = setTimeout(
      () => this.#schedule(),
      this.pollIntervalMs
    );
  }

  /**
   * Process one batch.
   */
  async #processBatch() {
    const events =
      await this.outboxRepository.fetchAndLockPending(
        this.batchSize,
        this.maxRetries
      );

    if (!events.length) {
      return;
    }

    this.logger.info?.(
      `[OutboxWorker] Processing ${events.length} event(s).`
    );

    for (const event of events) {
      await this.#dispatch(event);
    }
  }

  /**
   * Dispatch one event.
   */
  async #dispatch(event) {
    try {
      await this.dispatcher.dispatch(event);

      await this.outboxRepository.markAsDispatched(
        event.id
      );

      this.logger.info?.(
        `[OutboxWorker] ${event.eventName} dispatched.`
      );
    } catch (error) {
      this.logger.error?.(
        `[OutboxWorker] Failed ${event.eventName}`,
        error
      );

      await this.outboxRepository.incrementRetry(
        event.id,
        error.message
      );
    }
  }
}