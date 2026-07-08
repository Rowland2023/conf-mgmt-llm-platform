import { PostgresOutboxRepository } from "../infrastructure/repositories/PostgresOutboxRepository.js";

export class OutboxPublisher {
  constructor({ db, kafkaProducer, pollIntervalMs = 1000, batchSize = 100 }) {
    this.db = db;
    this.kafka = kafkaProducer;
    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
    this.running = false;
    this.isProcessing = false; // UPGRADE: Tracks active thread execution state
    this.timeoutRef = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    console.log("[OutboxPublisher] Worker service started successfully.");
    this.scheduleNextTick();
  }

  scheduleNextTick() {
    if (!this.running) return;
    
    this.timeoutRef = setTimeout(async () => {
      try {
        this.isProcessing = true; // UPGRADE: Guard state open
        await this.tick();
      } catch (err) {
        console.error("[OutboxPublisher] Uncaught cycle exception:", err.message);
      } finally {
        this.isProcessing = false; // UPGRADE: Guard state closed
        this.scheduleNextTick();
      }
    }, this.pollIntervalMs);
  }

  async tick() {
    let client;
    let transactionActive = false;

    try {
      client = await this.db.getClient();
      const outboxRepo = new PostgresOutboxRepository(client);

      // PHASE 1: Fetch and transition rows to 'PROCESSING' state atomically
      await client.query('BEGIN');
      transactionActive = true;

      const batch = await outboxRepo.fetchUnprocessed(this.batchSize, client);

      if (!batch.length) {
        await client.query('COMMIT');
        transactionActive = false;
        return;
      }

      const batchIds = batch.map(r => r.id);
      await outboxRepo.markAsProcessingBatch(batchIds, client);

      await client.query('COMMIT');
      transactionActive = false;
      
      client.release();
      client = null; 

      // Guard: If a shutdown signal came in while running Phase 1, do not proceed to network I/O
      if (!this.running) {
        console.warn("[OutboxPublisher] Shutdown detected mid-cycle. Relinquishing batch via recovery mechanism.");
        await this.handleEmergencyReversal(batchIds);
        return;
      }

      // PHASE 2: Concurrent Network Dispatch to Kafka Brokers
      const publishPromises = batch.map(record => {
        try {
          return this.kafka.send(record.eventType, record.payload, record.id)
            .then(() => ({ id: record.id, success: true }))
            .catch((err) => {
              console.error(`[OutboxPublisher] Failed to push event ${record.id}:`, err.message);
              return { id: record.id, success: false };
            });
        } catch (syncError) {
          // UPGRADE: Catch synchronized engine execution rejections cleanly
          console.error(`[OutboxPublisher] Synchronous dispatch error on event ${record.id}:`, syncError.message);
          return Promise.resolve({ id: record.id, success: false });
        }
      });

      const results = await Promise.all(publishPromises);
      const successfulIds = results.filter(r => r.success).map(r => r.id);
      const failedIds = results.filter(r => !r.success).map(r => r.id);

      // PHASE 3: Re-acquire connection context to write final resolutions
      if ((successfulIds.length > 0 || failedIds.length > 0) && this.running) {
        client = await this.db.getClient();
        const finalRepo = new PostgresOutboxRepository(client);
        
        await client.query('BEGIN');
        transactionActive = true;
        
        if (successfulIds.length > 0) {
          await finalRepo.markManyAsProcessed(successfulIds, client);
        }
        
        if (failedIds.length > 0) {
          await finalRepo.revertToPendingBatch(failedIds, client);
        }
        
        await client.query('COMMIT');
        transactionActive = false;
      } else if (!this.running) {
        // If system stopped during network ops, push everything back to pending for next startup container
        console.warn("[OutboxPublisher] Shutdown detected during network phase. Rolling batch back to pending state.");
        await this.handleEmergencyReversal(batchIds);
      }
    } catch (error) {
      console.error("[OutboxPublisher] Batch routing execution crashed:", error);
      if (client && transactionActive) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          console.error("[OutboxPublisher] Emergency socket rollback failed:", rollbackErr.message);
        }
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Emergency Reversal Helper
   * Restores row state visibility to 'PENDING' outside standard tick workflows
   */
  async handleEmergencyReversal(ids) {
    let fallbackClient;
    try {
      fallbackClient = await this.db.getClient();
      const repo = new PostgresOutboxRepository(fallbackClient);
      await fallbackClient.query('BEGIN');
      await repo.revertToPendingBatch(ids, fallbackClient);
      await fallbackClient.query('COMMIT');
    } catch (err) {
      console.error("[OutboxPublisher] Failed to safely execute state reversal loop:", err.message);
    } finally {
      if (fallbackClient) fallbackClient.release();
    }
  }

  /**
   * Graceful Drain Stop Engine
   * Awaits active worker termination before completing process teardown routine
   */
  async stop() {
    this.running = false;
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    // UPGRADE: Active polling drain wait loop
    while (this.isProcessing) {
      console.log("[OutboxPublisher] Awaiting active batch worker thread depletion...");
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("[OutboxPublisher] Worker loop stopped cleanly. Threads fully drained.");
  }
}