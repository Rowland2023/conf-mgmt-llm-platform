import { randomUUID } from "crypto";

export class OutboxRecord {
  constructor({ id, aggregateType, aggregateId, eventType, payload, occurredAt, processedAt = null }) {
    if (!aggregateType || !aggregateId || !eventType || !payload) {
      throw new Error("OutboxRecord Invariant Violation: Missing required structural attributes.");
    }

    this.id = id || randomUUID();
    this.aggregateType = aggregateType; 
    this.aggregateId = aggregateId; 
    this.eventType = eventType; 
    
    // ENHANCEMENT: Deep freeze or store a fresh deep-clone snapshot to prevent internal mutation leaks
    this.payload = Object.freeze(JSON.parse(JSON.stringify(payload))); 
    
    this.occurredAt = occurredAt instanceof Date ? occurredAt : new Date(occurredAt || Date.now());
    this.processedAt = processedAt ? (processedAt instanceof Date ? processedAt : new Date(processedAt)) : null;
  }

  /**
   * Idempotent progression marker
   */
  markProcessed() {
    if (this.processedAt) return; // Prevent overwriting an already processed chronological stamp
    this.processedAt = new Date();
  }

  /**
   * Helper mapping layout ensuring your persistence repositories 
   * get perfectly flattened primitive types without payload drift.
   */
  toPersistence() {
    return {
      id: this.id,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: JSON.stringify(this.payload), // Explicitly serialize here
      occurredAt: this.occurredAt.toISOString(),
      processedAt: this.processedAt ? this.processedAt.toISOString() : null
    };
  }
}