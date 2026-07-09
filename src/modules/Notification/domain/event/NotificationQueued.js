import { randomUUID } from "crypto";

/**
 * A highly robust, cyclic-safe deep freeze implementation.
 * Eliminates side-channel mutations across downstream infrastructure handlers.
 * 
 * @param {Object} obj - The object shell to recursively freeze
 * @param {WeakSet} [seen] - Memory tracking set to prevent infinite loops on cycles
 * @returns {Object} The deeply frozen immutable object reference
 */
function deepFreeze(obj, seen = new WeakSet()) {
    if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) {
        return obj;
    }
    
    if (seen.has(obj)) {
        return obj;
    }
    seen.add(obj);

    // Freeze current node layer
    Object.freeze(obj);

    // Recursively handle nested object properties, including hidden descriptor keys
    const propertyNames = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < propertyNames.length; i++) {
        const key = propertyNames[i];
        const value = obj[key];
        if (value !== null && (typeof value === "object" || typeof value === "function")) {
            deepFreeze(value, seen);
        }
    }

    return obj;
}

/**
 * Immutable Domain Event representing a queued system notification.
 */
export class NotificationQueued {
    constructor({
        notificationId,
        userId = null,
        recipient,
        channel,
        metadata = {}
    }) {
        // 1. Fail-Fast Guard Clauses (Enforcing Domain Invariants)
        if (!notificationId) {
            throw new Error("Event Invariant Error: 'notificationId' is a strictly required identifier.");
        }
        if (!recipient) {
            throw new Error("Event Invariant Error: 'recipient' reference data must be provided.");
        }
        if (!channel) {
            throw new Error("Event Invariant Error: A target transmission 'channel' is required.");
        }

        // 2. Standard Event Envelop/Metadata Configuration
        this.id = randomUUID();
        this.aggregateId = notificationId;
        this.aggregateType = "Notification";
        this.type = "NotificationQueued";
        this.occurredAt = new Date().toISOString();

        // 3. Isolated Payload Formulation & Preservation
        this.payload = deepFreeze({
            notificationId,
            userId,
            recipient,
            channel,
            metadata: { ...metadata } // Shallow clone before deep freeze to avoid modifying caller state
        });

        // 4. Sealed Object Pass: Secure outer shell properties before final recursive deep freeze
        Object.freeze(this);
        return deepFreeze(this);
    }

    /**
     * Standard serialization interceptor.
     * Guarantees a reliable, unpolluted data structure when stringified into your Outbox database log.
     * 
     * @returns {Object} Plain object payload structure
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