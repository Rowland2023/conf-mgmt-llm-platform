export class PostgresOutboxRepository {
    /**
     * Persists an extracted domain event cleanly to the relational transactional outbox log.
     * Must be passed an active transaction client to remain atomic with aggregate changes.
     * 
     * @param {Object} domainEvent - Core structured domain event payload instance
     * @param {Object} trx - Active database transaction client wrapper
     * @returns {Promise<void>}
     */
    async save(domainEvent, trx) {
        if (!domainEvent) throw new Error("Outbox Error: Domain event reference is empty.");
        if (!trx) throw new Error("Outbox Error: Shared database transaction context is required for atomic outbox mutations.");

        // Fallback structural parsing if the event lacks a native serialization method
        const eventData = typeof domainEvent.toJSON === "function" 
            ? domainEvent.toJSON() 
            : {
                id: domainEvent.id,
                aggregateId: domainEvent.aggregateId,
                aggregateType: domainEvent.aggregateType || "Notification",
                type: domainEvent.type || domainEvent.constructor.name,
                occurredAt: domainEvent.occurredAt,
                payload: domainEvent.payload || { ...domainEvent }
              };

        // Extract values from serialized dataset to guarantee immutability safety
        const eventId = eventData.id;
        const eventName = eventData.type;
        const aggregateType = eventData.aggregateType;
        const aggregateId = eventData.aggregateId;
        const occurredAt = eventData.occurredAt || new Date();
        
        // Deep clone or sanitize the payload reference if needed without mutating frozen entities
        const cleanPayload = { ...eventData.payload };

        await trx.query(
            `INSERT INTO outbox_events (
                id, event_name, aggregate_type, aggregate_id, payload, status, occurred_at, processed_at, retry_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
            [
                eventId,
                eventName,
                aggregateType,
                aggregateId,
                JSON.stringify(cleanPayload),
                "pending", // New events start out pending processing
                occurredAt,
                null,      // Not yet dispatched out to Message Broker (RabbitMQ/Kafka)
                0          // Initial failure backoff tracking state
            ]
        );
    }
}