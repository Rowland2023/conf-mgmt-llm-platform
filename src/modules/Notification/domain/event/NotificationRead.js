// src/modules/notification/domain/events/NotificationRead.js

import { randomUUID } from "crypto";

/**
 * Cyclic-safe deep freeze utility.
 * Ensures complete event immutability.
 */
function deepFreeze(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) {
        return obj;
    }

    if (seen.has(obj)) {
        return obj;
    }

    seen.add(obj);

    Object.freeze(obj);

    for (const key of Object.getOwnPropertyNames(obj)) {
        const value = obj[key];

        if (value !== null && (typeof value === "object" || typeof value === "function")) {
            deepFreeze(value, seen);
        }
    }

    return obj;
}

/**
 * Immutable Domain Event
 * Published when a notification has been read by its recipient.
 */
export class NotificationRead {
    constructor({
        notificationId,
        userId = null,
        recipient,
        channel,
        readAt = new Date(),
        metadata = {}
    }) {
        // -----------------------------------------------------------------
        // Domain Invariants
        // -----------------------------------------------------------------

        if (!notificationId) {
            throw new Error("Event Invariant Error: 'notificationId' is required.");
        }

        if (!recipient) {
            throw new Error("Event Invariant Error: 'recipient' is required.");
        }

        if (!channel) {
            throw new Error("Event Invariant Error: 'channel' is required.");
        }

        const readTimestamp = new Date(readAt);

        if (Number.isNaN(readTimestamp.getTime())) {
            throw new Error("Event Invariant Error: 'readAt' must be a valid date.");
        }

        // -----------------------------------------------------------------
        // Event Envelope
        // -----------------------------------------------------------------

        this.id = randomUUID();
        this.aggregateId = notificationId;
        this.aggregateType = "Notification";
        this.type = "NotificationRead";
        this.occurredAt = new Date().toISOString();

        // -----------------------------------------------------------------
        // Immutable Payload
        // -----------------------------------------------------------------

        this.payload = deepFreeze({
            notificationId,
            userId,
            recipient,
            channel,
            readAt: readTimestamp.toISOString(),
            metadata: { ...metadata }
        });

        return deepFreeze(this);
    }

    /**
     * Stable serialization for the Outbox pattern.
     */
    toJSON() {
        return {
            id: this.id,
            aggregateId: this.aggregateId,
            aggregateType: this.aggregateType,
            type: this.type,
            occurredAt: this.occurredAt,
            payload: this.payload
        };
    }
}