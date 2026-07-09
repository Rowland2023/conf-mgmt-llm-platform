import crypto from "crypto";
import { DomainInvariantError } from "../../../../Shared/errors/DomainErrors.js";
import { deepFreeze } from "../../../../Shared/utils/deepFreeze.js";

/**
 * Raised when an event has been cancelled.
 * Pure Immutable Domain Event.
 */
export class EventCancelled {
  /**
   * @param {Object} data
   * @param {string} data.eventId - Aggregate Root Identifier reference
   * @param {string|null} [data.reason=null] - Reason explaining the cancellation
   * @param {string|null} [data.correlationId=null] - Distributed tracing identifier tracking transaction trees
   * @param {Date|string} [data.occurredAt=new Date()] - Explicit creation date hook
   * @param {string|null} [data.id=null] - Optional override used solely by factory hydration layers
   */
  constructor({
    eventId,
    reason = null,
    correlationId = null,
    occurredAt = new Date(),
    id = null
  }) {
    if (!eventId) {
      throw new DomainInvariantError("EventCancelled: initialization missing parameter [eventId].");
    }

    const parsedOccurred = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    if (Number.isNaN(parsedOccurred.getTime())) {
      throw new DomainInvariantError("EventCancelled: Invalid occurredAt timestamp provided.");
    }

    // Normalize whitespace-only reasons to a clean null
    const normalizedReason = typeof reason === "string" && reason.trim() !== "" 
      ? reason.trim() 
      : null;

    this.id = id || crypto.randomUUID();
    this.aggregateId = eventId;
    this.aggregateType = "Event";
    this.type = "EventCancelled";
    this.version = 1;
    this.occurredAt = parsedOccurred.toISOString();
    this.correlationId = correlationId || null;

    this.payload = deepFreeze({
      eventId,
      reason: normalizedReason
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
      version: this.version,
      occurredAt: this.occurredAt,
      correlationId: this.correlationId,
      payload: this.payload
    };
  }

  /**
   * Static Rehydration Factory Engine.
   * Reconstructs historical instances out of saved storage arrays without generating new IDs.
   * 
   * @param {Object} json - Document map pulled out of the infrastructure database.
   * @returns {EventCancelled}
   */
  static fromJSON(json) {
    if (!json?.payload) {
      throw new DomainInvariantError("EventCancelled: Cannot rehydrate event from an invalid or empty object payload structure.");
    }

    return new EventCancelled({
      id: json.id,
      eventId: json.aggregateId || json.payload.eventId,
      reason: json.payload.reason,
      correlationId: json.correlationId,
      occurredAt: json.occurredAt
    });
  }
}