// modules/payment/domain/events/PaymentCancelledEvent.js
import { ValidationError } from "../errors/PaymentErrors.js";

export class PaymentCancelledEvent {
  constructor({
    id,
    paymentId,
    bookingId,
    tenantId,
    userId = null,
    amount,
    currency,
    gateway,
    reason = "User abandoned checkout session",
    cancelledBy = "CUSTOMER",
    cancelledAt = new Date()
  }) {
    // 1. Core Architectural Identity Guards
    if (!id) throw new ValidationError("Event ID is required.");
    if (!paymentId) throw new ValidationError("Payment aggregate ID is required.");
    if (!bookingId) throw new ValidationError("Booking ID is required.");
    if (!tenantId) throw new ValidationError("Tenant ID is required.");

    // 2. Financial Context Guards
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError("Payment amount must be a positive integer in minor units.");
    }
    if (!/^[A-Z]{3}$/i.test(currency)) {
      throw new ValidationError("Invalid currency code format.");
    }

    // 3. Operational Cancellation Guards
    if (!gateway) throw new ValidationError("Gateway identifier is required.");
    if (!["CUSTOMER", "SYSTEM", "ADMIN"].includes(cancelledBy.toUpperCase())) {
      throw new ValidationError("Invalid actor assignment for cancelledBy attribute.");
    }

    this.name = "PaymentCancelledEvent";
    this.version = 1;

    // Isolate cross-cutting architectural routing details
    this.metadata = Object.freeze({
      eventId: id,
      aggregateId: paymentId,
      aggregateType: "Payment",
      occurredAt: cancelledAt instanceof Date ? cancelledAt : new Date(cancelledAt)
    });

    // Isolate pure contextual cancellation data fields
    this.payload = Object.freeze({
      paymentId,
      bookingId,
      tenantId,
      userId,
      amount,
      currency: currency.toUpperCase(),
      gateway,
      cancellation: Object.freeze({
        reason,
        initiatedBy: cancelledBy.toUpperCase()
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