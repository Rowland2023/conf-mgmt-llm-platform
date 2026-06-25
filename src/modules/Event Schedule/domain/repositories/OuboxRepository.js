import { OutboxRecord } from "../domain/models/OutboxRecord.js";

export class PostgresOutboxRepository {
  /**
   * @param {import('pg').PoolClient | import('pg').Pool} defaultClient
   */
  constructor(defaultClient) {
    if (!defaultClient || typeof defaultClient.query !== 'function') {
      throw new Error("PostgresOutboxRepository requires a valid pg client or pool instance.");
    }
    this.defaultClient = defaultClient;
  }

  /**
   * 1. THE WRITE PATH
   * Appends an event record to the outbox.
   * CRITICAL: Pass the transaction-scoped 'trxClient' to ensure it runs inside the atomic ACID transaction.
   */
  async save(outboxRecord, trxClient = this.defaultClient) {
    const queryText = `
      INSERT INTO outbox_messages 
        (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, processed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    // Cleanly delegate formatting, dates, and JSON serialization to the domain entity
    const persistData = outboxRecord.toPersistence();

    await trxClient.query(queryText, [
      persistData.id,
      persistData.aggregateType,
      persistData.aggregateId,
      persistData.eventType,
      persistData.payload,
      persistData.occurredAt,
      persistData.processedAt
    ]);
  }

  /**
   * 2. THE BACKGROUND PUBLISHER PATH (CONCURRENTLY SAFE FETCH)
   * Fetches an unprocessed batch of events using row-locking mechanisms optimized for worker queues.
   */
  async fetchUnprocessed(batchSize = 100, trxClient = this.defaultClient) {
    // FOR UPDATE SKIP LOCKED guarantees that multiple background workers won't fetch the same records
    const queryText = `
      SELECT id, aggregate_type, aggregate_id, event_type, payload, occurred_at, processed_at
      FROM outbox_messages
      WHERE processed_at IS NULL
      ORDER BY occurred_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `;

    const { rows } = await trxClient.query(queryText, [batchSize]);
    return rows.map(row => this.toDomain(row));
  }

  /**
   * 3. THE IDEMPOTENT PROGRESSION PATH
   * Marks a single outbox record as fully processed. Emits warning if row is absent.
   */
  async markAsProcessed(id, trxClient = this.defaultClient) {
    const queryText = `
      UPDATE outbox_messages
      SET processed_at = NOW()
      WHERE id = $1 AND processed_at IS NULL
    `;

    const { rowCount } = await trxClient.query(queryText, [id]);
    
    if (rowCount === 0) {
      console.warn(`[PostgresOutboxRepository] Optimization Target Not Found or Already Processed: ${id}`);
    }
  }

  /**
   * Data Mapping Layer
   */
  toDomain(row) {
    return new OutboxRecord({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      occurredAt: new Date(row.occurred_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : null
    });
  }
}