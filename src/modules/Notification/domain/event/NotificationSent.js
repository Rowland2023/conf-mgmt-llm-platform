import { randomUUID } from "crypto";
import { ValidationError } from "../../../../Shared/errors/ApplicationErrors.js";

/**
 * Bottom-up deep-freezes an object graph to guarantee runtime event immutability.
 * Uses Reflect.ownKeys to safely map standard names as well as internal Symbol markers.
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

export class NotificationSent {
    constructor({
        notificationId,
        userId = null,
        conferenceId = null,
        channel,
        sentAt = new Date(),
        correlationId = null
    }) {
        // Assert domain boundaries using your uniform error schema
        if (!notificationId) {
            throw new ValidationError("NotificationSent: notificationId is required.");
        }

        if (!channel) {
            throw new ValidationError("NotificationSent: channel is required.");
        }

        const timestamp = new Date(sentAt);
        if (Number.isNaN(timestamp.getTime())) {
            throw new ValidationError("NotificationSent: sentAt must be a valid, parsable date configuration.");
        }

        // Structural Outbox Metadata
        this.id = randomUUID();
        this.aggregateId = notificationId;
        this.aggregateType = "Notification";
        this.type = "NotificationSent";
        this.occurredAt = timestamp.toISOString();
        this.correlationId = correlationId || null;

        // Domain Specific Payload Shell
        this.payload = {
            notificationId,
            userId,
            conferenceId,
            channel,
            sentAt: timestamp.toISOString()
        };

        // Single atomic top-down deep freeze operation
        deepFreeze(this);
    }

    /**
     * Provides a clean structured plain object format for database serialization 
     * and message brokers (e.g., RabbitMQ, Kafka).
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