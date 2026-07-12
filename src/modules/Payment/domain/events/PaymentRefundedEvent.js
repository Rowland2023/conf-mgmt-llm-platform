import { ValidationError } from "../errors/PaymentErrors.js";

export class PaymentRefundedEvent {
  constructor({
    id,
    paymentId,
    bookingId,
    tenantId = null,
    amountRefunded,
    remainingBalance,
    currency,
    status,
    processedBy,
    occurredAt = new Date()
  }) {
    // Structural Integrity Guards
    if (!id) throw new ValidationError("Event ID required.");
    if (!paymentId) throw new ValidationError("Payment aggregate ID required.");
    if (!bookingId) throw new ValidationError("Booking ID required.");

    // Core Financial Integrity Guards (Minor Units / Integers)
    if (!Number.isInteger(amountRefunded) || amountRefunded <= 0) {
      throw new ValidationError("Refund amount must be a positive integer in minor units.");
    }
    if (!Number.isInteger(remainingBalance) || remainingBalance < 0) {
      throw new ValidationError("Remaining balance must be a non-negative integer in minor units.");
    }

    // State & Vocabulary Guards
    if (!["PARTIALLY_REFUNDED", "REFUNDED"].includes(status)) {
      throw new ValidationError("Invalid refund state.");
    }
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new ValidationError("Invalid currency code.");
    }

    this.name = "PaymentRefundedEvent";
    this.version = 1;

    // Enforce deep immutability across event structural boundaries
    this.metadata = Object.freeze({
      eventId: id,
      aggregateId: paymentId,
      aggregateType: "Payment",
      occurredAt: occurredAt instanceof Date ? occurredAt : new Date(occurredAt)
    });

    this.payload = Object.freeze({
      paymentId,
      bookingId,
      tenantId,
      amountRefunded,
      remainingBalance,
      currency: currency.toUpperCase(),
      status,
      processedBy
    });

    Object.freeze(this);
  }

  /**
   * Serializes the domain event into a standard data structure.
   * Maintains structured sub-objects to prevent property name collisions.
   */
  toJSON() {
    return {
      eventName: this.name,
      version: this.version,
      metadata: { ...this.metadata },
      payload: { ...this.payload }
    };
  }
}