import { DomainEvent } from "../../../../Shared/domain/DomainEvent.js";
import { EventDeserializationError } from "../../../../Shared/errors/DomainErrors.js";

export class EventRescheduled extends DomainEvent {
  constructor({
    eventId,
    previousStartTime,
    previousEndTime,
    newStartTime,
    newEndTime,
    rescheduledBy, // required for audit
    reason = 'user_request',
    occurredAt, // required - when decision was made
    correlationId = null,
    causationId = null
  }) {
    // 1. Structural validation only - no business rules
    if (!eventId) throw new EventDeserializationError("EventRescheduled: eventId required.");
    if (!previousStartTime) throw new EventDeserializationError("EventRescheduled: previousStartTime required.");
    if (!previousEndTime) throw new EventDeserializationError("EventRescheduled: previousEndTime required.");
    if (!newStartTime) throw new EventDeserializationError("EventRescheduled: newStartTime required.");
    if (!newEndTime) throw new EventDeserializationError("EventRescheduled: newEndTime required.");
    if (!rescheduledBy) throw new EventDeserializationError("EventRescheduled: rescheduledBy required.");
    if (!occurredAt) throw new EventDeserializationError("EventRescheduled: occurredAt required.");

    const pStart = new Date(previousStartTime);
    const pEnd = new Date(previousEndTime);
    const nStart = new Date(newStartTime);
    const nEnd = new Date(newEndTime);
    const parsedOccurred = new Date(occurredAt);

    // 2. Format validation only
    if (Number.isNaN(pStart.getTime())) throw new EventDeserializationError("EventRescheduled: Invalid previousStartTime");
    if (Number.isNaN(pEnd.getTime())) throw new EventDeserializationError("EventRescheduled: Invalid previousEndTime");
    if (Number.isNaN(nStart.getTime())) throw new EventDeserializationError("EventRescheduled: Invalid newStartTime");
    if (Number.isNaN(nEnd.getTime())) throw new EventDeserializationError("EventRescheduled: Invalid newEndTime");
    if (Number.isNaN(parsedOccurred.getTime())) throw new EventDeserializationError("EventRescheduled: Invalid occurredAt");

    // NOTE: No chronological checks. Aggregate enforces that. Events record facts.

    super({
      eventName: "event.rescheduled",
      eventVersion: 1,
      aggregateId: eventId,
      occurredAt: parsedOccurred,
      correlationId,
      causationId
    });

    this.payload = Object.freeze({
      eventId,
      previousStartTime: pStart.toISOString(),
      previousEndTime: pEnd.toISOString(),
      newStartTime: nStart.toISOString(),
      newEndTime: nEnd.toISOString(),
      rescheduledBy,
      reason
    });

    this.freezeEvent();
  }

  static fromJSON(json) {
    if (!json?.payload) {
      throw new EventDeserializationError("EventRescheduled: Cannot rehydrate from invalid payload.");
    }
    return new EventRescheduled({
      eventId: json.payload.eventId,
      previousStartTime: json.payload.previousStartTime,
      previousEndTime: json.payload.previousEndTime,
      newStartTime: json.payload.newStartTime,
      newEndTime: json.payload.newEndTime,
      rescheduledBy: json.payload.rescheduledBy,
      reason: json.payload.reason,
      occurredAt: json.metadata.occurredAt,
      correlationId: json.metadata.correlationId,
      causationId: json.metadata.causationId
    });
  }
}