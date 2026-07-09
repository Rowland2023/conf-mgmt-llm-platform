import crypto from "crypto";

/**
 * Raised when a new event has been successfully scheduled.
 * Pure Immutable Domain Event.
 * 
 * Implements strict structural timestamp guards to enforce structural safety
 * across application, database, and message bus boundaries.
 */
export class EventScheduled {
    /**
     * @param {Object} data
     * @param {string} data.eventId - Aggregate Root Identifier reference
     * @param {string} data.title - Title name descriptor of the event
     * @param {string} data.roomId - Target room resource allocation key
     * @param {Date|string} data.startTime - Cron start timestamp boundary
     * @param {Date|string} data.endTime - Cron end timestamp boundary
     * @param {string|null} [data.correlationId=null] - Distributed tracing identifier tracking transaction trees
     * @param {Date|string} [data.occurredAt] - Explicit creation date hook
     * @param {string} [data.id] - Optional override used solely by factory hydration layers
     */
    constructor({
        eventId,
        title,
        roomId,
        startTime,
        endTime,
        correlationId = null,
        occurredAt = new Date(),
        id = null
    }) {
        if (!eventId) throw new Error("EventScheduled: initialization missing parameter [eventId].");
        if (!title) throw new Error("EventScheduled: initialization missing parameter [title].");
        if (!roomId) throw new Error("EventScheduled: initialization missing parameter [roomId].");
        if (!startTime) throw new Error("EventScheduled: initialization missing parameter [startTime].");
        if (!endTime) throw new Error("EventScheduled: initialization missing parameter [endTime].");

        // 1. Explicit Timestamp Parsing Safeguards
        const parsedStart = startTime instanceof Date ? startTime : new Date(startTime);
        const parsedEnd = endTime instanceof Date ? endTime : new Date(endTime);
        const parsedOccurred = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);

        if (Number.isNaN(parsedStart.getTime())) {
            throw new Error(`EventScheduled: Invalid timestamp payload evaluated for [startTime]: ${startTime}`);
        }
        if (Number.isNaN(parsedEnd.getTime())) {
            throw new Error(`EventScheduled: Invalid timestamp payload evaluated for [endTime]: ${endTime}`);
        }
        if (Number.isNaN(parsedOccurred.getTime())) {
            throw new Error(`EventScheduled: Invalid timestamp payload evaluated for [occurredAt]: ${occurredAt}`);
        }

        // 2. State Mapping Assignments
        this.id = id || crypto.randomUUID();
        this.aggregateId = eventId;
        this.aggregateType = "Event";
        this.type = "EventScheduled";
        this.occurredAt = parsedOccurred.toISOString();
        this.correlationId = correlationId || null;

        this.payload = deepFreeze({
            eventId,
            title,
            roomId,
            startTime: parsedStart.toISOString(),
            endTime: parsedEnd.toISOString()
        });

        Object.freeze(this);
    }

    /**
     * Standard contract serializer method.
     * Maps internal structures to raw JSON primitive collections safely.
     * 
     * @returns {Object}
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

    /**
     * Static Rehydration Factory Engine.
     * Reconstructs historical instances out of saved storage arrays without generating new IDs.
     * Handles flexible structural matching for both root level keys and internal payloads.
     * 
     * @param {Object} json - Document map pulled out of the infrastructure database.
     * @returns {EventScheduled}
     */
    static fromJSON(json) {
        if (!json || !json.payload) {
            throw new Error("EventScheduled: Cannot rehydrate historical snapshot from empty object signatures.");
        }
        
        // Defensive extract normalization handling both raw construction variants and event store schemas smoothly
        const extractedEventId = json.aggregateId || json.payload.eventId;
        
        return new EventScheduled({
            id: json.id,
            eventId: extractedEventId,
            title: json.payload.title,
            roomId: json.payload.roomId,
            startTime: json.payload.startTime,
            endTime: json.payload.endTime,
            correlationId: json.correlationId,
            occurredAt: json.occurredAt
        });
    }
}

/**
 * Deep freezes flat object properties.
 * Primitives are protected; nested objects are scanned recursively.
 */
function deepFreeze(obj) {
    if (!obj || typeof obj !== "object") return obj;

    Object.freeze(obj);

    for (const key of Object.keys(obj)) {
        const value = obj[key];

        if (
            value &&
            typeof value === "object" &&
            !Object.isFrozen(value)
        ) {
            deepFreeze(value);
        }
    }

    return obj;
}