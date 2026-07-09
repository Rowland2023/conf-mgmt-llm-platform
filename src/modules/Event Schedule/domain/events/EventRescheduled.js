import crypto from "crypto";
import { DomainInvariantError } from "../../../../Shared/errors/DomainErrors.js";
import { deepFreeze } from "../../../../Shared/utils/deepFreeze.js";

/**
 * Raised when an existing event has been rescheduled.
 * Pure Immutable Domain Event.
 */
export class EventRescheduled {
  /**
   * @param {Object} data
   * @param {string} data.eventId - Aggregate Root Identifier reference
   * @param {Date|string} data.previousStartTime - Original start timestamp boundary
   * @param {Date|string} data.previousEndTime - Original end timestamp boundary
   * @param {Date|string} data.newStartTime - Updated target start timestamp boundary
   * @param {Date|string} data.newEndTime - Updated target end timestamp boundary
   * @param {string|null} [data.correlationId=null] - Distributed tracing identifier tracking transaction trees
   * @param {Date|string} [data.occurredAt] - Explicit creation date hook
   * @param {string} [data.id] - Optional override used solely by factory hydration layers
   */
  constructor({
    eventId,
    previousStartTime,
    previousEndTime,
    newStartTime,
    newEndTime,
    correlationId = null,
    occurredAt = new Date(),
    id = null
  }) {
    // 1. Assert structural mandatory presence
    if (!eventId) throw new DomainInvariantError("EventRescheduled: eventId required.");
    if (!previousStartTime) throw new DomainInvariantError("EventRescheduled: previousStartTime required.");
    if (!previousEndTime) throw new DomainInvariantError("EventRescheduled: previousEndTime required.");
    if (!newStartTime) throw new DomainInvariantError("EventRescheduled: newStartTime required.");
    if (!newEndTime) throw new DomainInvariantError("EventRescheduled: newEndTime required.");

    const pStart = previousStartTime instanceof Date ? previousStartTime : new Date(previousStartTime);
    const pEnd = previousEndTime instanceof Date ? previousEndTime : new Date(previousEndTime);
    const nStart = newStartTime instanceof Date ? newStartTime : new Date(newStartTime);
    const nEnd = newEndTime instanceof Date ? newEndTime : new Date(newEndTime);
    const parsedOccurred = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);

    // 2. Validate date format correctness
    if (Number.isNaN(pStart.getTime())) throw new DomainInvariantError("EventRescheduled: Invalid previousStartTime");
    if (Number.isNaN(pEnd.getTime())) throw new DomainInvariantError("EventRescheduled: Invalid previousEndTime");
    if (Number.isNaN(nStart.getTime())) throw new DomainInvariantError("EventRescheduled: Invalid newStartTime");
    if (Number.isNaN(nEnd.getTime())) throw new DomainInvariantError("EventRescheduled: Invalid newEndTime");
    if (Number.isNaN(parsedOccurred.getTime())) throw new DomainInvariantError("EventRescheduled: Invalid occurredAt");

    // 3. Chronological safety limits checks
    if (pStart.getTime() >= pEnd.getTime()) {
      throw new DomainInvariantError("EventRescheduled: Previous startTime must be strictly before previous endTime.");
    }
    if (nStart.getTime() >= nEnd.getTime()) {
      throw new DomainInvariantError("EventRescheduled: New startTime must be strictly before new endTime.");
    }

    // 4. State Assignment Mapping
    this.id = id || crypto.randomUUID();
    this.aggregateId = eventId;
    this.aggregateType = "Event";
    this.type = "EventRescheduled";
    this.version = 1;
    this.occurredAt = parsedOccurred.toISOString();
    this.correlationId = correlationId || null;

    this.payload = deepFreeze({
      eventId,
      previousStartTime: pStart.toISOString(),
      previousEndTime: pEnd.toISOString(),
      newStartTime: nStart.toISOString(),
      newEndTime: nEnd.toISOString()
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
   * @returns {EventRescheduled}
   */
  static fromJSON(json) {
    if (!json?.payload) {
      throw new DomainInvariantError("EventRescheduled: Cannot rehydrate event from an invalid or empty object payload structure.");
    }
    
    return new EventRescheduled({
      id: json.id,
      eventId: json.aggregateId || json.payload.eventId,
      previousStartTime: json.payload.previousStartTime,
      previousEndTime: json.payload.previousEndTime,
      newStartTime: json.payload.newStartTime,
      newEndTime: json.payload.newEndTime,
      correlationId: json.correlationId,
      occurredAt: json.occurredAt
    });
  }
}