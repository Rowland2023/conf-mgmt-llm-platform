// modules/payment/domain/events/PaymentFailedEvent.js
import { ValidationError } from "../errors/PaymentErrors.js";

export class PaymentFailedEvent {
  constructor({
    id,
    paymentId,
    bookingId,
    tenantId,
    userId = null,
    amount,
    currency,
    gateway,
    idempotencyKey,
    failureReason,
    failureCode = "UNKNOWN_FAILURE",
    failedAt = new Date()
  }) {
    // 1. Core Architectural Identity Guards
    if (!id) throw new ValidationError("Event ID is required.");
    if (!paymentId) throw new ValidationError("Payment aggregate ID is required.");
    if (!bookingId) throw new ValidationError("Booking ID is required.");
    if (!tenantId) throw new ValidationError("Tenant ID is required.");

    // 2. Financial Context Guards (Pristine Audit Records)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError("Payment amount must be a positive integer in minor units.");
    }
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new ValidationError("Invalid currency code format.");
    }

    // 3. Operational Failure Guards
    if (!gateway) throw new ValidationError("Gateway identifier is required.");
    if (!idempotencyKey) throw new ValidationError("Idempotency key is required.");
    if (!failureReason) throw new ValidationError("Failure reason message is required.");

    this.name = "PaymentFailedEvent";
    this.version = 1;

    // Isolate cross-cutting architectural routing details
    this.metadata = Object.freeze({
      eventId: id,
      aggregateId: paymentId,
      aggregateType: "Payment",
      occurredAt: failedAt instanceof Date ? failedAt : new Date(failedAt)
    });

    // Isolate pure contextual failure data fields
    this.payload = Object.freeze({
      paymentId,
      bookingId,
      tenantId,
      userId,
      amount,
      currency: currency.toUpperCase(),
      gateway,
      idempotencyKey,
      failure: Object.freeze({
        reason: failureReason,
        code: failureCode.toUpperCase()
      })
    });

    Object.freeze(this);
  }

  /**
   * Serializes the domain event into a standard data structure safely.
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