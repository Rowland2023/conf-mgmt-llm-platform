// src/modules/payment/domain/Payment.js
import { AggregateRoot } from "../../../../Shared/domain/AggregateRoot.js";
import { Money } from "../value-objects/Money.js";
import { PaymentStatus } from "../value-objects/PaymentStatus.js";
import { PaymentCreatedEvent } from "../events/PaymentCreatedEvent.js";
import { PaymentSuccessfulEvent } from "../events/PaymentSuccessfulEvent.js";
import { PaymentReleasedEvent } from "./events/PaymentReleasedEvent.js";
import { ValidationError, UnprocessableEntityError } from "../errors/PaymentErrors.js";

export class Payment extends AggregateRoot {
  constructor(props) {
    super(props.id, props.version); // base handles id + version + events

    this._tenantId = props.tenantId;
    this._contextId = props.contextId; // bookingId, orderId, escrowId
    this._contextType = props.contextType; // 'booking', 'order', 'escrow'
    this._money = new Money(props.amount, props.currency);
    this._status = new PaymentStatus(props.status);
    this._sellerId = props.sellerId || null; // recipient for escrow release
    this._gatewayTransactionId = props.gatewayTransactionId || null;
    this._paidAt = props.paidAt || null;
    this._releasedAt = props.releasedAt || null;
    this._createdAt = props.createdAt || null;
    this._updatedAt = props.updatedAt || null;
  }

  // -----------------------------------------------------------------
  // Getters - aggregate is immutable outside of business methods
  // -----------------------------------------------------------------
  get tenantId() { return this._tenantId; }
  get contextId() { return this._contextId; }
  get contextType() { return this._contextType; }
  get money() { return this._money; }
  get amount() { return this._money.amount; }
  get currency() { return this._money.currency; }
  get status() { return this._status.value; }
  get sellerId() { return this._sellerId; }
  get gatewayTransactionId() { return this._gatewayTransactionId; }
  get paidAt() { return this._paidAt; }
  get releasedAt() { return this._releasedAt; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  // -----------------------------------------------------------------
  // Factory
  // -----------------------------------------------------------------
  static create(cmd) {
    if (!cmd.createdAt) throw new ValidationError("createdAt required");
    if (!cmd.contextId) throw new ValidationError("contextId required");
    if (!cmd.contextType) throw new ValidationError("contextType required");

    const payment = new Payment({
      id: cmd.id,
      version: 0,
      tenantId: cmd.tenantId,
      contextId: cmd.contextId,
      contextType: cmd.contextType,
      amount: cmd.amount,
      currency: cmd.currency,
      status: PaymentStatus.CREATED,
      sellerId: cmd.sellerId || null,
      createdAt: cmd.createdAt,
      updatedAt: cmd.createdAt
    });

    payment.addDomainEvent(
      new PaymentCreatedEvent({
        paymentId: payment.id,
        tenantId: payment.tenantId,
        contextId: payment.contextId,
        contextType: payment.contextType,
        amount: payment.amount,
        currency: payment.currency,
        correlationId: cmd.correlationId,
        causationId: cmd.causationId,
        occurredAt: cmd.createdAt
      })
    );

    return payment;
  }

  // -----------------------------------------------------------------
  // Business Methods
  // -----------------------------------------------------------------

  markSuccessful({ gatewayTransactionId, paidAt, correlationId }) {
    if (this.isSuccessful()) return this; // idempotent

    if (!this.canTransitionTo(PaymentStatus.SUCCESSFUL)) {
      throw new UnprocessableEntityError(
        `Cannot complete payment while status is '${this.status}'.`
      );
    }
    if (!gatewayTransactionId) throw new ValidationError("gatewayTransactionId required");
    if (!paidAt) throw new ValidationError("paidAt required for audit");

    this._status = new PaymentStatus(PaymentStatus.SUCCESSFUL);
    this._paidAt = paidAt;
    this._gatewayTransactionId = gatewayTransactionId;
    this._incrementVersion();
    this._updatedAt = paidAt;

    this.addDomainEvent(new PaymentSuccessfulEvent({
      paymentId: this.id,
      tenantId: this._tenantId,
      contextId: this._contextId,
      contextType: this._contextType,
      amount: this.amount,
      currency: this.currency,
      gatewayTransactionId,
      correlationId: correlationId || this.currentCorrelationId,
      occurredAt: paidAt
    }));

    return this;
  }

  /**
   * Release escrowed funds to seller. Idempotent.
   * Use after buyer confirms delivery or escrow timer expires.
   */
  release({ sellerId, gatewayTransactionId, releasedAt, correlationId, causationId }) {
    if (this.isReleased()) return this; // idempotent

    if (!this.canTransitionTo(PaymentStatus.RELEASED)) {
      throw new UnprocessableEntityError(
        `Cannot release payment. Status is '${this.status}'. Expected 'HELD' or 'SUCCESSFUL'.`
      );
    }
    if (!releasedAt) throw new ValidationError("releasedAt required for audit");
    if (!gatewayTransactionId) throw new ValidationError("gatewayTransactionId required for payout");

    this._status = new PaymentStatus(PaymentStatus.RELEASED);
    this._releasedAt = releasedAt;
    this._sellerId = sellerId || this._sellerId;
    this._gatewayTransactionId = gatewayTransactionId;
    this._incrementVersion();
    this._updatedAt = releasedAt;

    this.addDomainEvent(new PaymentReleasedEvent({
      paymentId: this.id,
      tenantId: this._tenantId,
      contextId: this._contextId,
      contextType: this._contextType,
      sellerId: this._sellerId,
      amountReleased: this._money.amount, // minor units
      currency: this._money.currency,
      gatewayTransactionId,
      correlationId: correlationId || this.currentCorrelationId,
      causationId,
      occurredAt: releasedAt
    }));

    return this;
  }

  // -----------------------------------------------------------------
  // State Guards
  // -----------------------------------------------------------------
  isSuccessful() {
    return this._status.equals(PaymentStatus.SUCCESSFUL) || this._status.equals(PaymentStatus.RELEASED);
  }

  isReleased() {
    return this._status.equals(PaymentStatus.RELEASED);
  }

  canTransitionTo(newStatus) {
    const transitions = {
      [PaymentStatus.CREATED]: [PaymentStatus.PENDING, PaymentStatus.SUCCESSFUL, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
      [PaymentStatus.PENDING]: [PaymentStatus.HELD, PaymentStatus.SUCCESSFUL, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
      [PaymentStatus.HELD]: [PaymentStatus.RELEASED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.CANCELLED],
      [PaymentStatus.SUCCESSFUL]: [PaymentStatus.HELD, PaymentStatus.RELEASED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED],
      [PaymentStatus.RELEASED]: [], // terminal
      [PaymentStatus.REFUNDED]: [], // terminal
      [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED, PaymentStatus.RELEASED],
      [PaymentStatus.FAILED]: [], // terminal
      [PaymentStatus.CANCELLED]: [] // terminal
    };

    return transitions[this._status.value]?.includes(newStatus) || false;
  }

  // -----------------------------------------------------------------
  // Rehydration
  // -----------------------------------------------------------------
  static fromPersistence(data) {
    return new Payment({
      id: data.id,
      version: data.version,
      tenantId: data.tenant_id,
      contextId: data.context_id,
      contextType: data.context_type,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      sellerId: data.seller_id,
      gatewayTransactionId: data.gateway_transaction_id,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      releasedAt: data.released_at ? new Date(data.released_at) : null,
      createdAt: data.created_at ? new Date(data.created_at) : null,
      updatedAt: data.updated_at ? new Date(data.updated_at) : null
    });
  }
}