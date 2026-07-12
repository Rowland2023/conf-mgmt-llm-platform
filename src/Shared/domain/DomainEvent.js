import { randomUUID } from 'crypto';

export class DomainEvent {
  /**
   * @param {Object} params
   * @param {string} params.eventName - E.g., 'attendee.checked-in'
   * @param {number} params.eventVersion - Incremental version for schema evolution
   * @param {string} [params.eventId] - Unique identifier for this event instance
   * @param {Date} [params.occurredAt] - Timestamp when the event actually happened
   * @param {string} [params.correlationId] - ID to trace the casual chain across modules
   * @param {string} [params.causationId] - ID of the message/request that triggered this event
   */
  constructor({
    eventName,
    eventVersion = 1,
    eventId = randomUUID(),
    occurredAt = new Date(),
    correlationId = null,
    causationId = null
  }) {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('DomainEvent requires a string eventName');
    }
    if (typeof eventVersion !== 'number' || eventVersion < 1) {
      throw new Error('eventVersion must be a positive integer');
    }
    if (!(occurredAt instanceof Date) || isNaN(occurredAt.getTime())) {
      throw new Error('occurredAt must be a valid Date');
    }

    this.metadata = Object.freeze({
      eventId,
      eventName,
      eventVersion,
      occurredAt: occurredAt.toISOString(), // string to prevent mutation
      correlationId,
      causationId
    });

    // Subclasses will attach their payloads, then freeze themselves.
  }
}