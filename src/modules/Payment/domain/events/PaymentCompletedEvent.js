// modules/payment/domain/events/PaymentCompletedEvent.js
import { ValidationError } from "../errors/PaymentErrors.js";

export class PaymentCompletedEvent {
  constructor({
    id,
    paymentId,
    bookingId,
    tenantId,
    userId = null,
    amount,
    currency,
    gateway,
    gatewayTransactionId,
    idempotencyKey,
    paidAt = new Date()
  }) {
    // 1. Core Architectural Identity Guards
    if (!id) throw new ValidationError("Event ID is required.");
    if (!paymentId) throw new ValidationError("Payment aggregate ID is required.");
    if (!bookingId) throw new ValidationError("Booking ID is required.");
    if (!tenantId) throw new ValidationError("Tenant ID is required.");

    // 2. Financial Integrity Guards (Strict Integers for Minor Units)
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError("Payment amount must be a positive integer in minor units.");
    }
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new ValidationError("Invalid currency code format. Must be an ISO 3-letter string.");
    }

    // 3. Operational Audit Guards
    if (!gateway) throw new ValidationError("Gateway identifier is required.");
    if (!gatewayTransactionId) throw new ValidationError("Gateway transaction reference ID is required.");
    if (!idempotencyKey) throw new ValidationError("Idempotency key is required.");

    this.name = "PaymentCompletedEvent";
    this.version = 1;

    // Isolate cross-cutting architectural routing details
    this.metadata = Object.freeze({
      eventId: id,
      aggregateId: paymentId,
      aggregateType: "Payment",
      occurredAt: paidAt instanceof Date ? paidAt : new Date(paidAt)
    });

    // Isolate pure contextual business data fields
    this.payload = Object.freeze({
      paymentId,
      bookingId,
      tenantId,
      userId,
      amount,
      currency: currency.toUpperCase(),
      gateway,
      gatewayTransactionId,
      idempotencyKey
    });

    Object.freeze(this);
  }

  /**
   * Serializes the domain event into a standard data structure safely.
   * Keeps metadata and payload structurally separated to avoid root property conflicts.
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