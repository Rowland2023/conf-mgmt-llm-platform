// modules/payment/domain/events/PaymentCreatedEvent.js

import { ValidationError } from "../errors/PaymentErrors.js";

export class PaymentCreatedEvent {
  constructor({
    id,
    paymentId,
    bookingId,
    tenantId = null,
    userId = null,
    amount,
    currency,
    gateway = null,
    email,
    idempotencyKey,
    correlationId = null,
    createdAt = new Date()
  }) {

    // 1. Core Architectural Identity Guards
    if (!id || typeof id !== "string") {
      throw new ValidationError("Event ID is required.");
    }

    if (!paymentId || typeof paymentId !== "string") {
      throw new ValidationError("Payment aggregate ID is required.");
    }

    if (!bookingId || typeof bookingId !== "string") {
      throw new ValidationError("Booking ID is required.");
    }

    // Support both individual and corporate payments
    if (!tenantId && !userId) {
      throw new ValidationError(
        "Either tenantId or userId is required."
      );
    }


    // 2. Financial Intent Guards
    // Amount is stored in minor currency units
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError(
        "Payment amount must be a positive integer in minor units."
      );
    }

    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/i.test(currency)
    ) {
      throw new ValidationError(
        "Invalid currency code format. Must be ISO 3-letter code."
      );
    }


    // 3. Customer & Request Integrity Guards
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new ValidationError(
        "A valid customer email is required."
      );
    }

    if (
      !idempotencyKey ||
      typeof idempotencyKey !== "string"
    ) {
      throw new ValidationError(
        "Idempotency key is required."
      );
    }


    // 4. Event Identity
    this.name = "PaymentCreatedEvent";
    this.version = 1;


    // 5. Event Metadata Envelope
    this.metadata = Object.freeze({
      eventId: id,
      aggregateId: paymentId,
      aggregateType: "Payment",
      correlationId,
      occurredAt:
        createdAt instanceof Date
          ? createdAt
          : new Date(createdAt)
    });


    // 6. Immutable Business Payload
    this.payload = Object.freeze({
      paymentId,
      bookingId,
      tenantId,
      userId,
      amount,
      currency: currency.toUpperCase(),
      gateway,
      email,
      idempotencyKey
    });


    // Prevent mutation
    Object.freeze(this);
  }


  /**
   * Serialize event safely for:
   * - Transactional Outbox
   * - Kafka publishing
   * - Audit storage
   */
  toJSON() {
    return {
      eventName: this.name,
      version: this.version,
      metadata: {
        ...this.metadata
      },
      payload: {
        ...this.payload
      }
    };
  }
}