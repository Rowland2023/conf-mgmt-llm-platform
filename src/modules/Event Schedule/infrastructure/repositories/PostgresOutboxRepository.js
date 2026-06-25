import { OutboxRecord } from "../persistence/OutboxRecord.js";
import { DuplicateKeyError } from "../../application/errors/DuplicateKeyError.js";

/**
 * PostgresOutboxRepository
 * Implements transactional outbox pattern for reliable event publishing.
 * Safe for concurrent workers via FOR UPDATE SKIP LOCKED.
 */
export class PostgresOutboxRepository {
  /**
   * @param {import('pg').Pool | import('pg').PoolClient} defaultClient
   */
  constructor(defaultClient) {
    if (!defaultClient || typeof defaultClient.query!== 'function') {
      throw new Error("PostgresOutboxRepository requires a valid pg Pool or PoolClient.");
    }
    this.defaultClient = defaultClient;
  }

  /**
   * 1. WRITE PATH - Must run inside business transaction
   * @param {OutboxRecord} outboxRecord
   * @param {import('pg').PoolClient} trxClient - Transaction client from UseCase
   * @throws {DuplicateKeyError} on ID collision
   */
  async save(outboxRecord, trxClient = this.defaultClient) {
    const d = outboxRecord.toPersistence();
    const queryText = `
      INSERT INTO outbox
        (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, processed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    try {
      await trxClient.query(queryText, [
        d.id,
        d.aggregateType,
        d.aggregateId,
        d.eventType,
        d.payload,
        d.occurredAt,
        d.processedAt
      ]);
    } catch (e) {
      if (e.code === '23505') {
        throw new DuplicateKeyError(`OutboxRecord ${d.id} already exists`);
      }
      throw e;
    }
  }

  /**
   * 2. PUBLISHER PATH - Concurrent-safe batch fetch
   * Uses FOR UPDATE SKIP LOCKED so multiple workers don't clash.
   * @param {number} batchSize
   * @param {import('pg').PoolClient} trxClient - Use dedicated client per worker
   * @returns {Promise<OutboxRecord[]>}
   */
  async fetchUnprocessed(batchSize = 100, trxClient = this.defaultClient) {
    const { rows } = await trxClient.query(
      `SELECT id, aggregate_type, aggregate_id, event_type, payload, occurred_at, processed_at
       FROM outbox
       WHERE processed_at IS NULL
       ORDER BY occurred_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    return rows.map(row => this.toDomain(row));
  }

  /**
   * 3a. SINGLE PROGRESSION PATH - For admin tools / retry handlers
   * Idempotent: no-op if already processed.
   * @param {string} id
   * @param {import('pg').PoolClient} trxClient
   */
  async markAsProcessed(id, trxClient = this.defaultClient) {
    const { rowCount } = await trxClient.query(
      `UPDATE outbox
       SET processed_at = NOW()
       WHERE id = $1 AND processed_at IS NULL`,
      [id]
    );
    if (rowCount === 0) {
      console.warn(`[OutboxRepo] Record not found or already processed: ${id}`);
    }
    return rowCount;
  }

  /**
   * 3b. BATCH PROGRESSION PATH - Use this in publisher worker
   * Critical for throughput. 1 query instead of N.
   * @param {string[]} ids
   * @param {import('pg').PoolClient} trxClient
   * @returns {Promise<number>} Count of records actually marked
   */
  async markManyAsProcessed(ids, trxClient = this.defaultClient) {
    if (!ids.length) return 0;
    const { rowCount } = await trxClient.query(
      `UPDATE outbox
       SET processed_at = NOW()
       WHERE id = ANY($1::uuid[]) AND processed_at IS NULL`,
      [ids]
    );
    if (rowCount!== ids.length) {
      console.warn(
        `[OutboxRepo] Marked ${rowCount}/${ids.length} records. Some were already processed.`
      );
    }
    return rowCount;
  }

  /**
   * 4. OBSERVABILITY - For monitoring/dead-letter handling
   * @param {import('pg').PoolClient} client
   */
  async getStats(client = this.defaultClient) {
    const { rows } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE processed_at IS NULL) as pending,
         COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed,
         MIN(occurred_at) FILTER (WHERE processed_at IS NULL) as oldest_pending
       FROM outbox`
    );
    return {
      pending: parseInt(rows[0].pending, 10),
      processed: parseInt(rows[0].processed, 10),
      oldestPending: rows[0].oldest_pending
    };
  }

  /**
   * Data Mapping Layer - pg JSONB + timestamptz auto-parse
   * @private
   */
  toDomain(row) {
    return new OutboxRecord({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload, // JSONB already parsed by pg
      occurredAt: row.occurred_at, // timestamptz already Date
      processedAt: row.processed_at
    });
  }
}
