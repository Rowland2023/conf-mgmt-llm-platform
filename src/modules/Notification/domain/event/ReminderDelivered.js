import { randomUUID } from "crypto";
import { ValidationError } from "../../../../Shared/errors/ApplicationErrors.js";

/**
 * Bottom-up deep-freezes an object graph to guarantee event immutability.
 * Uses Reflect.ownKeys to catch both string names and internal Symbol markers safely.
 */
function deepFreeze(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) {
        return obj;
    }

    if (seen.has(obj)) {
        return obj;
    }

    seen.add(obj);

    // Recursively freeze child properties first to ensure child stability before locking the parent node
    for (const key of Reflect.ownKeys(obj)) {
        const value = obj[key];
        if (value !== null && typeof value === "object") {
            deepFreeze(value, seen);
        }
    }

    return Object.freeze(obj);
}

export class ReminderDelivered {
    constructor({
        notificationId,
        conferenceId,
        userId = null,
        channel,
        deliveredAt = new Date(),
        correlationId = null
    }) {
        // 1. Enforce business invariants using the uniform error schema
        if (!notificationId) {
            throw new ValidationError("ReminderDelivered: notificationId is required.");
        }

        if (!conferenceId) {
            throw new ValidationError("ReminderDelivered: conferenceId is required.");
        }

        if (!channel) {
            throw new ValidationError("ReminderDelivered: channel is required.");
        }

        const timestamp = new Date(deliveredAt);
        if (Number.isNaN(timestamp.getTime())) {
            throw new ValidationError("ReminderDelivered: deliveredAt must be a valid, parsable date.");
        }

        // 2. Structured Outbox Envelope Layout Metadata
        this.id = randomUUID();
        this.aggregateId = notificationId;
        this.aggregateType = "Notification";
        this.type = "ReminderDelivered";
        this.occurredAt = timestamp.toISOString();
        this.correlationId = correlationId || null;

        // 3. Domain Event Payload Shell
        this.payload = {
            notificationId,
            conferenceId,
            userId,
            channel,
            deliveredAt: timestamp.toISOString()
        };

        // 4. Single atomic bottom-up deep freeze pass
        deepFreeze(this);
    }

    /**
     * Serializes the immutable domain event into a plain object map for outbox 
     * database insertion and message streaming topologies (Kafka / RabbitMQ).
     */
    toJSON() {
        return {
            id: this.id,
            aggregateId: this.aggregateId,
            aggregateType: this.aggregateType,
            type: this.type,
            occurredAt: this.occurredAt,
            correlationId: this.correlationId,
            payload: this.payload
        };
    }
}