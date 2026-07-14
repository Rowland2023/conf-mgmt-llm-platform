// src/modules/ticket/domain/entities/Ticket.js
import { Money } from "../value-objects/Money.js";
import { DomainError } from "../../../shared/domain/DomainError.js";

export class Ticket {
  #id;
  #conferenceId;
  #type;
  #price;
  #capacity;
  #reserved;
  #sold;
  #status;
  #version;
  #events = [];

  constructor({ id, conferenceId, type, price, capacity, reserved = 0, sold = 0, status = 'ACTIVE', version = 0 }) {
    this.#id = id;
    this.#conferenceId = conferenceId;
    this.#type = type;
    this.#price = price;
    this.#capacity = capacity;
    this.#reserved = reserved;
    this.#sold = sold;
    this.#status = status;
    this.#version = version;
  }

  // Getters
  get id() { return this.#id; }
  get conferenceId() { return this.#conferenceId; }
  get type() { return this.#type; }
  get price() { return this.#price; }
  get capacity() { return this.#capacity; }
  get reserved() { return this.#reserved; }
  get sold() { return this.#sold; }
  get status() { return this.#status; }
  get version() { return this.#version; }
  get available() { return this.#capacity - (this.#reserved + this.#sold); }

  /**
   * CRITICAL: Called on every state mutation
   * Postgres checks: UPDATE tickets SET version=version+1 WHERE id=? AND version=?
   */
  #incrementVersion() {
    this.#version += 1;
  }

  /**
   * Reserve seats - creates pending hold before payment
   */
  reserve(quantity, userId, correlationId) {
    this.#assertActive();
    if (quantity <= 0) throw new DomainError("Reservation quantity must be greater than zero.");
    if (this.available < quantity) {
      throw new DomainError(
        `Insufficient ticket capacity. Requested: ${quantity}, Available: ${this.available}`
      );
    }

    this.#reserved += quantity;
    this.#incrementVersion(); // <-- CRITICAL

    this.#addEvent({
      type: 'ticket.reserved',
      payload: { 
        ticketId: this.#id,
        conferenceId: this.#conferenceId,
        userId,
        quantity,
        availableAfter: this.available,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 min hold
      },
      correlationId
    });
  }

  /**
   * Release expired holds - called by cron or payment failure
   */
  release(quantity, correlationId) {
    this.#assertActive();
    if (quantity <= 0) throw new DomainError("Release quantity must be greater than zero.");
    if (this.#reserved < quantity) {
      throw new DomainError(
        `Cannot release more tickets than reserved. Reserved: ${this.#reserved}, Requested: ${quantity}`
      );
    }

    this.#reserved -= quantity;
    this.#incrementVersion(); // <-- CRITICAL

    this.#addEvent({
      type: 'ticket.released',
      payload: { 
        ticketId: this.#id,
        conferenceId: this.#conferenceId,
        quantity,
        availableAfter: this.available
      },
      correlationId
    });
  }

  /**
   * Convert reserved to sold - called after payment webhook succeeds
   */
  confirmPurchase(quantity, paymentId, correlationId) {
    this.#assertActive();
    if (quantity <= 0) throw new DomainError("Purchase quantity must be greater than zero.");
    if (this.#reserved < quantity) {
      throw new DomainError(
        `Cannot confirm more tickets than reserved. Reserved: ${this.#reserved}, Requested: ${quantity}`
      );
    }

    this.#reserved -= quantity;
    this.#sold += quantity;
    this.#incrementVersion(); // <-- CRITICAL

    this.#addEvent({
      type: 'ticket.purchased',
      payload: { 
        ticketId: this.#id,
        conferenceId: this.#conferenceId,
        quantity,
        paymentId,
        soldTotal: this.#sold,
        revenue: this.#price.multiply(quantity).amount
      },
      correlationId
    });
  }

  /**
   * Cancel ticket class - stops all future sales
   */
  cancel(reason, correlationId) {
    this.#assertActive();
    this.#status = 'CANCELLED';
    this.#incrementVersion(); // <-- CRITICAL

    this.#addEvent({
      type: 'ticket.cancelled',
      payload: { 
        ticketId: this.#id,
        conferenceId: this.#conferenceId,
        reason,
        refundableCount: this.#sold,
        reservedToRelease: this.#reserved
      },
      correlationId
    });
  }

  #assertActive() {
    if (this.#status === 'CANCELLED') {
      throw new DomainError("Action forbidden. This ticket class has been cancelled.");
    }
  }

  #addEvent(event) {
    this.#events.push({
      ...event,
      occurredAt: new Date(),
      aggregateId: this.#id,
      aggregateType: 'Ticket'
    });
  }

  pullEvents() {
    const eventsToPublish = [...this.#events];
    this.#events = [];
    return eventsToPublish;
  }

  /**
   * Factory: Creates new ticket with validation
   */
  static create({ conferenceId, type, price, capacity, correlationId }) {
    if (!conferenceId) throw new DomainError("ConferenceId is required");
    if (!type) throw new DomainError("Ticket type is required");
    if (!(price instanceof Money)) throw new DomainError("Price must be Money value object");
    if (capacity <= 0) throw new DomainError("Capacity must be greater than zero");

    const ticket = new Ticket({
      id: crypto.randomUUID(),
      conferenceId,
      type,
      price,
      capacity,
      reserved: 0,
      sold: 0,
      status: 'ACTIVE',
      version: 0
    });

    ticket.#addEvent({
      type: 'ticket.created',
      payload: {
        ticketId: ticket.#id,
        conferenceId,
        type,
        price: price.amount,
        currency: price.currency,
        capacity
      },
      correlationId
    });

    return ticket;
  }

  /**
   * Rehydration: Rebuild from database
   */
  static rehydrate(data) {
    return new Ticket(data);
  }
}