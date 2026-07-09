/**
 * Generic Transactional Outbox Worker Core Architecture.
 * Decouples database record states from network transport latency.
 */
export class OutboxWorker {
    constructor({
        outboxRepository,
        dispatcher,
        logger = console,
        batchSize = 100,
        concurrencyLimit = 10,
        maxRetries = 5
    }) {
        if (!outboxRepository) throw new Error("OutboxWorker requires an outboxRepository.");
        if (!dispatcher) throw new Error("OutboxWorker requires a dispatcher.");

        this.outboxRepository = outboxRepository;
        this.dispatcher = dispatcher;
        this.logger = logger;
        this.batchSize = batchSize;
        this.concurrencyLimit = concurrencyLimit;
        this.maxRetries = maxRetries;
        
        this.timer = null;
        this.isProcessing = false;
        this.shouldStop = false;
    }

    /**
     * Process one batch of pending events with bounded internal concurrency execution.
     * @returns {Promise<{ processed: number, failed: number }>} Batch processing yield metrics
     */
    async process() {
        if (this.isProcessing) return { processed: 0, failed: 0 };
        this.isProcessing = true;

        try {
            // 1. Fetch and immediately transition row status to an 'IN_PROGRESS' lock state.
            //    This keeps database transactions short (<50ms) and frees up row locks before network I/O.
            const events = await this.outboxRepository.fetchAndLockPending(this.batchSize, this.maxRetries);

            if (!events || !events.length) {
                return { processed: 0, failed: 0 };
            }

            let failedCount = 0;

            // 2. Safely iterate through chunks knowing these rows are locked to this instance id
            for (let i = 0; i < events.length; i += this.concurrencyLimit) {
                if (this.shouldStop) break;
                
                const chunk = events.slice(i, i + this.concurrencyLimit);
                const results = await Promise.all(chunk.map(event => this.#processSingleEvent(event)));
                
                failedCount += results.filter(success => !success).length;
            }

            return { 
                processed: events.length, 
                failed: failedCount 
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * @private
     * @returns {Promise<boolean>} True if dispatched successfully, false if trapped by error boundary
     */
    async #processSingleEvent(event) {
        try {
            await this.dispatcher.dispatch(event);
            await this.outboxRepository.markAsDispatched(event.id);

            this.logger.info?.(`Outbox event ${event.id} dispatched successfully.`, {
                eventType: event.eventName,
                aggregateId: event.aggregateId
            });
            return true;
        } catch (error) {
            this.logger.error?.(`Outbox dispatch failed for event ${event.id}`, {
                error: error.message,
                eventType: event.eventName
            });

            try {
                // Release our custom state-lock and increment standard exponential backoff counters
                await this.outboxRepository.incrementRetry(event.id, error.message);
            } catch (repoError) {
                this.logger.error?.(`Critical Outbox State Lock Leak: Failed retry-state increment on event ${event.id}`, repoError);
            }
            return false;
        }
    }

    /**
     * Starts the non-overlapping execution scheduling loop.
     */
    start(intervalMs = 5000) {
        if (this.timer || this.shouldStop) return;
        this.shouldStop = false;

        this.logger.info?.(`OutboxWorker daemon started (poll interval: ${intervalMs}ms)`);

        const loop = async () => {
            if (this.shouldStop) return;

            let forceImmediateNext = false;

            try {
                const { processed, failed } = await this.process();
                
                // Backpressure Check: Only request an immediate next batch if we maxed out the batch capacity 
                // AND we aren't spinning our wheels on a wall of failing downstream systems.
                if (processed === this.batchSize && failed < (this.batchSize * 0.5)) {
                    forceImmediateNext = true;
                }
            } catch (error) {
                this.logger.error?.("Unexpected OutboxWorker processing cycle crash.", error);
            }

            if (forceImmediateNext && !this.shouldStop) {
                setImmediate(loop);
            } else {
                this.timer = setTimeout(loop, intervalMs);
            }
        };

        this.timer = setTimeout(loop, intervalMs);
    }

    /**
     * Gracefully terminates polling operations.
     */
    async stop() {
        this.shouldStop = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        while (this.isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.logger.info?.("OutboxWorker stopped cleanly.");
    }
}