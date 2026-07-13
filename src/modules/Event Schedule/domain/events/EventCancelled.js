// src/modules/conference/domain/events/EventCancelled.js

import { DomainEvent } from "../../../../Shared/domain/DomainEvent.js"; // Adjust path to your base DomainEvent class
import { DomainInvariantError } from "../../../../Shared/errors/DomainErrors.js";

/**
 * Raised when an event has been cancelled.
 * Pure Immutable Domain Event.
 */
export class EventCancelled extends DomainEvent {
  /**
   * @param {Object} data
   * @param {string} data.eventId - Aggregate Root Identifier reference
   * @param {string|null} [data.reason=null] - Reason explaining the cancellation
   * @param {string|null} [data.correlationId=null] - Distributed tracing token
   * @param {string|null} [data.causationId=null] - Causal trace origin token
   * @param {Date|string} [data.occurredAt=new Date()] - Explicit creation date hook
   */
  constructor({
    eventId,
    reason = null,
    correlationId = null,
    causationId = null,
    occurredAt = new Date()
  }) {
    // 1. Enforce business invariants first
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

    // 2. Delegate Envelope, Identity, and Tracing Metadata to the Parent Base Class
    super({
      eventName: "event.cancelled",
      eventVersion: 1,
      aggregateId: eventId,
      occurredAt: parsedOccurred,
      correlationId,
      causationId
    });

    // 3. Formulate Domain-Specific Payload Shell
    this.payload = {
      eventId,
      reason: normalizedReason
    };

    // 4. Single atomic top-down deep freeze pass handled uniformly by base class utility
    this.freezeEvent();
  }

  /**
   * Standard contract serializer method.
   * Maps internal structures to raw JSON structures for the outbox table or brokers.
   * 
   * @returns {Object}
   */
  toJSON() {
    return {
      eventName: this.metadata.eventName,
      version: this.metadata.eventVersion,
      metadata: this.metadata,
      payload: this.payload
    };
  }

  /**
   * Static Rehydration Factory Engine.
   * Reconstructs historical instances out of saved infrastructure logs without side effects.
   * 
   * @param {Object} json - Document map pulled out of the infrastructure database.
   * @returns {EventCancelled}
   */
  static fromJSON(json) {
    if (!json?.payload) {
      throw new DomainInvariantError("EventCancelled: Cannot rehydrate event from an invalid or empty payload structure.");
    }

    // Extract values dynamically respecting both nested metadata envelopes and older flat formats
    const metadata = json.metadata || {};
    
    return new EventCancelled({
      eventId: json.aggregateId || metadata.aggregateId || json.payload.eventId,
      reason: json.payload.reason,
      correlationId: json.correlationId || metadata.correlationId,
      causationId: json.causationId || metadata.causationId,
      occurredAt: json.occurredAt || metadata.occurredAt
    });
  }
}