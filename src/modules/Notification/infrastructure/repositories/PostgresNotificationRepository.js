import { Notification } from "../../domain/aggregates/Notification.js";

export class PostgresNotificationRepository {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.dbClient - PG Pool or Knex/driver instance supporting .query()
     * @param {Object} dependencies.eventOutboxRepository - The outbox repository instance
     */
    constructor({ dbClient, eventOutboxRepository }) {
        this.dbClient = dbClient;
        this.eventOutboxRepository = eventOutboxRepository;
    }

    /**
     * Resolves a notification via a standard, non-blocking read operation.
     * Ideal for read-heavy flows that do not perform state updates (e.g., UI display).
     * 
     * @param {string} id - The notification aggregate identity UUID
     * @param {Object} [trx=null] - Optional shared database transaction instance
     * @returns {Promise<Notification|null>}
     */
    async findById(id, trx = null) {
        if (!id) throw new Error("Repository Error: ID is required for a lookup query.");
        
        const client = trx || this.dbClient;
        const result = await client.query(
            `SELECT 
                id, user_id, conference_id, recipient, channel, subject, title, body, metadata, status, created_at, scheduled_for, sent_at, read_at
             FROM notifications 
             WHERE id = $1;`,
            [id]
        );

        if (result.rows.length === 0) return null;
        return this._mapToDomain(result.rows[0]);
    }

    /**
     * Resolves a notification and applies a row-level pessimistic lock (SELECT FOR UPDATE).
     * Prevents other cluster workers from reading or modifying this row until the transaction commits.
     */
    async findByIdForUpdate(id, trx) {
        if (!id) throw new Error("Repository Error: ID is required for a locked query lookup.");
        if (!trx) throw new Error("Repository Error: A valid transaction context is mandatory for pessimistic locking.");

        const result = await trx.query(
            `SELECT 
                id, user_id, conference_id, recipient, channel, subject, title, body, metadata, status, created_at, scheduled_for, sent_at, read_at
             FROM notifications 
             WHERE id = $1 
             FOR UPDATE;`,
            [id]
        );

        if (result.rows.length === 0) return null;
        return this._mapToDomain(result.rows[0]);
    }

    async save(notification, trx = null) {
        if (!notification) throw new Error("Repository Error: Notification aggregate instance is required.");

        const executeUnitOfWork = async (client) => {
            // 1. Snapshot and upsert the notification aggregate state shell
            await client.query(
                `INSERT INTO notifications (
                    id, user_id, conference_id, recipient, channel, subject, title, body, metadata, status, created_at, scheduled_for, sent_at, read_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    sent_at = EXCLUDED.sent_at,
                    read_at = EXCLUDED.read_at,
                    metadata = EXCLUDED.metadata;`,
                [
                    notification.id,
                    notification.userId,
                    notification.conferenceId,
                    notification.recipient,
                    notification.channel,
                    notification.subject,
                    notification.title,
                    notification.body,
                    JSON.stringify(notification.metadata || {}),
                    notification.status,
                    notification.createdAt,
                    notification.scheduledFor,
                    notification.sentAt,
                    notification.readAt
                ]
            );

            // 2. Extract and flush any internal uncommitted domain events
            const events = notification.pullEvents();
            if (events.length === 0) return;

            // 3. Forward events to the outbox repository within the exact same database transaction boundary
            const outboxSaves = events.map(event => 
                this.eventOutboxRepository.save(event, client)
            );
            await Promise.all(outboxSaves);
        };

        // Propagate upstream transaction context or fallback to auto-commit transaction block
        if (trx) {
            await executeUnitOfWork(trx);
        } else {
            await this.dbClient.transaction(async (fallbackTrx) => {
                await executeUnitOfWork(fallbackTrx);
            });
        }
    }

    /**
     * Map database row into clean Domain Aggregate representation
     * @private
     */
    _mapToDomain(row) {
        return new Notification({
            id: row.id,
            userId: row.user_id,
            conferenceId: row.conference_id,
            recipient: row.recipient,
            channel: row.channel,
            subject: row.subject,
            title: row.title,
            body: row.body,
            metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
            status: row.status,
            createdAt: row.created_at,
            scheduledFor: row.scheduled_for,
            sentAt: row.sent_at,
            readAt: row.read_at
        });
    }
}