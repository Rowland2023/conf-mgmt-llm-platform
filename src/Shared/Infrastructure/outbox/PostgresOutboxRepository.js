// src/shared/infrastructure/outbox/PostgresOutboxRepository.js

/**
 * PostgreSQL implementation of the Transactional Outbox.
 *
 * Responsibilities:
 * - Persist Domain Events atomically with Aggregate changes.
 * - Fetch unpublished events.
 * - Lock rows for concurrent workers.
 * - Mark events as dispatched.
 * - Increment retry count on failures.
 */
export class PostgresOutboxRepository {
  constructor({ sequelize }) {
    if (!sequelize) {
      throw new Error(
        "PostgresOutboxRepository requires a Sequelize instance."
      );
    }

    this.sequelize = sequelize;
  }

  /**
   * Persist one or more Domain Events.
   *
   * Must be called using the SAME transaction that
   * persists the Aggregate.
   *
   * @param {DomainEvent[]} events
   * @param {Transaction} trx
   */
  async save(events, trx) {
    if (!Array.isArray(events)) {
      events = [events];
    }

    if (!trx) {
      throw new Error(
        "Outbox save requires an active database transaction."
      );
    }

    for (const event of events) {
      const metadata = event.metadata;

      await this.sequelize.query(
        `
        INSERT INTO outbox_events (
            id,
            event_name,
            aggregate_id,
            event_version,
            correlation_id,
            causation_id,
            payload,
            status,
            retry_count,
            occurred_at
        )
        VALUES (
            :id,
            :eventName,
            :aggregateId,
            :eventVersion,
            :correlationId,
            :causationId,
            CAST(:payload AS jsonb),
            'PENDING',
            0,
            :occurredAt
        )
        `,
        {
          replacements: {
            id: metadata.eventId,
            eventName: metadata.eventName,
            aggregateId: metadata.aggregateId,
            eventVersion: metadata.eventVersion,
            correlationId: metadata.correlationId,
            causationId: metadata.causationId,
            occurredAt: metadata.occurredAt,
            payload: JSON.stringify(event.payload)
          },
          transaction: trx
        }
      );
    }
  }

  /**
   * Fetch and lock pending events.
   *
   * Uses SKIP LOCKED so multiple workers
   * can run safely.
   */
  async fetchAndLockPending(batchSize, maxRetries) {
    const [rows] = await this.sequelize.query(
      `
      UPDATE outbox_events
         SET status = 'PROCESSING'
       WHERE id IN (

            SELECT id
              FROM outbox_events
             WHERE status = 'PENDING'
               AND retry_count < :maxRetries
          ORDER BY occurred_at
             LIMIT :batchSize
             FOR UPDATE SKIP LOCKED

       )

      RETURNING *;
      `,
      {
        replacements: {
          batchSize,
          maxRetries
        }
      }
    );

    return rows;
  }

  /**
   * Mark an event as successfully dispatched.
   */
  async markAsDispatched(id) {
    await this.sequelize.query(
      `
      UPDATE outbox_events
         SET
            status='DISPATCHED',
            processed_at=NOW()
       WHERE id=:id
      `,
      {
        replacements: { id }
      }
    );
  }

  /**
   * Increment retry count after failure.
   */
  async incrementRetry(id, errorMessage) {
    await this.sequelize.query(
      `
      UPDATE outbox_events
         SET
            retry_count = retry_count + 1,
            status='PENDING',
            last_error=:error
       WHERE id=:id
      `,
      {
        replacements: {
          id,
          error: errorMessage
        }
      }
    );
  }
}