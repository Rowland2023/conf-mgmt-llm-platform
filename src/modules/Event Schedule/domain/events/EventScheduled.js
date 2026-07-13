import { DomainEvent } from "../../../../Shared/domain/DomainEvent.js";
import { DomainInvariantError } from "../../../../Shared/errors/DomainErrors.js";

const MAX_EVENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ISO_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

export class EventScheduled extends DomainEvent {
    constructor({
        eventId,
        title,
        roomId,
        startTime, // must be ISO-8601 UTC: 2026-08-01T09:00:00Z
        endTime,   // must be ISO-8601 UTC
        occurredAt, // required: decision time
        correlationId = null,
        causationId = null
    }) {
        if (!eventId) throw new DomainInvariantError("EventScheduled: eventId is required.");
        if (!title) throw new DomainInvariantError("EventScheduled: title is required.");
        if (!roomId) throw new DomainInvariantError("EventScheduled: roomId is required.");
        if (!startTime) throw new DomainInvariantError("EventScheduled: startTime is required.");
        if (!endTime) throw new DomainInvariantError("EventScheduled: endTime is required.");
        if (!occurredAt) throw new DomainInvariantError("EventScheduled: occurredAt is required.");

        // Force UTC to prevent timezone bugs
        if (!ISO_UTC_REGEX.test(startTime)) {
            throw new DomainInvariantError("EventScheduled: startTime must be ISO-8601 UTC, e.g. 2026-08-01T09:00:00Z");
        }
        if (!ISO_UTC_REGEX.test(endTime)) {
            throw new DomainInvariantError("EventScheduled: endTime must be ISO-8601 UTC");
        }

        const parsedStart = new Date(startTime);
        const parsedEnd = new Date(endTime);
        const parsedOccurred = new Date(occurredAt);

        if (Number.isNaN(parsedStart.getTime())) throw new DomainInvariantError("EventScheduled: invalid startTime");
        if (Number.isNaN(parsedEnd.getTime())) throw new DomainInvariantError("EventScheduled: invalid endTime");
        if (Number.isNaN(parsedOccurred.getTime())) throw new DomainInvariantError("EventScheduled: invalid occurredAt");

        if (parsedStart >= parsedEnd) {
            throw new DomainInvariantError("EventScheduled: startTime must be before endTime.");
        }

        const duration = parsedEnd - parsedStart;
        if (duration > MAX_EVENT_DURATION_MS) {
            throw new DomainInvariantError(`EventScheduled: duration exceeds max ${MAX_EVENT_DURATION_MS}ms`);
        }

        super({
            eventName: "event.scheduled",
            eventVersion: 1,
            aggregateId: eventId,
            occurredAt: parsedOccurred,
            correlationId,
            causationId
        });

        this.payload = Object.freeze({
            eventId,
            title,
            roomId,
            startTime: parsedStart.toISOString(),
            endTime: parsedEnd.toISOString()
        });

        this.freezeEvent();
    }

    static from(persisted) {
        if (!persisted?.payload) {
            throw new DomainInvariantError("EventScheduled: Cannot rehydrate from empty data.");
        }
        if (persisted.aggregateId !== persisted.payload.eventId) {
            throw new DomainInvariantError("EventScheduled: aggregateId mismatch during rehydration.");
        }
        
        return new EventScheduled({
            eventId: persisted.payload.eventId,
            title: persisted.payload.title,
            roomId: persisted.payload.roomId,
            startTime: persisted.payload.startTime,
            endTime: persisted.payload.endTime,
            occurredAt: persisted.metadata.occurredAt,
            correlationId: persisted.metadata.correlationId,
            causationId: persisted.metadata.causationId
        });
    }
}