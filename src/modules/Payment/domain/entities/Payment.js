import { Money } from "../value-objects/Money.js";
import { PaymentStatus } from "../value-objects/PaymentStatus.js";
import { ValidationError, UnprocessableEntityError } from "../errors/PaymentErrors.js";
import { PaymentCreatedEvent } from "../events/PaymentCreatedEvent.js";

export class Payment {
    constructor({
        id,
        tenantId,
        bookingId,
        amount,
        currency,
        gateway,
        email,
        userId = null,
        idempotencyKey,
        externalReference = null,
        checkoutUrl = null,
        status,
        failureReason = null,
        refundedAmount = 0,
        gatewayTransactionId = null,
        paidAt = null,
        cancelledReason = null,
        cancelledBy = null,
        cancelledAt = null,
        createdBy,
        createdAt,
        updatedAt = null
    }) {
        if (!id) throw new ValidationError("Payment id is required.");
        if (!tenantId) throw new ValidationError("tenantId is required.");
        if (!bookingId) throw new ValidationError("bookingId is required.");

        this._id = id;
        this._tenantId = tenantId;
        this._bookingId = bookingId;

        this._money = new Money(amount, currency);
        this._status = new PaymentStatus(status);
        this._refundedAmount = refundedAmount;

        this._gateway = gateway;
        this._email = email;
        this._userId = userId;
        this._idempotencyKey = idempotencyKey;

        this._externalReference = externalReference;
        this._checkoutUrl = checkoutUrl;
        this._failureReason = failureReason;

        // Core Tracking Fields
        this._gatewayTransactionId = gatewayTransactionId;
        this._paidAt = paidAt;
        this._cancelledReason = cancelledReason;
        this._cancelledBy = cancelledBy;
        this._cancelledAt = cancelledAt;

        this._createdBy = createdBy;
        this._createdAt = createdAt;
        this._updatedAt = updatedAt ?? createdAt;

        // Aggregate Root domain event buffer
        this._domainEvents = [];
    }

    /**
     * Factory for creating a brand-new payment aggregate.
     * Performs invariant validation and emits a PaymentCreatedEvent.
     */
    static create({
        id,
        tenantId,
        bookingId,
        amount,
        currency,
        gateway,
        email,
        userId = null,
        idempotencyKey,
        createdBy,
        createdAt = new Date()
    }) {
        if (!gateway) throw new ValidationError("gateway is required.");
        if (!email) throw new ValidationError("email is required.");
        if (!idempotencyKey) throw new ValidationError("idempotencyKey is required.");
        if (!createdBy) throw new ValidationError("createdBy is required.");

        const payment = new Payment({
            id,
            tenantId,
            bookingId,
            amount,
            currency,
            gateway,
            email,
            userId,
            idempotencyKey,
            externalReference: null,
            checkoutUrl: null,
            status: PaymentStatus.CREATED,
            failureReason: null,
            refundedAmount: 0,
            gatewayTransactionId: null,
            paidAt: null,
            cancelledReason: null,
            cancelledBy: null,
            cancelledAt: null,
            createdBy,
            createdAt,
            updatedAt: createdAt
        });

        payment.addDomainEvent(
            new PaymentCreatedEvent({
                paymentId: payment.id,
                tenantId: payment.tenantId,
                bookingId: payment.bookingId,
                amount: payment.amount,
                currency: payment.currency,
                gateway: payment.gateway,
                occurredAt: createdAt
            })
        );

        return payment;
    }

    /**
     * Rebuild an aggregate flawlessly from persistent storage.
     * Maps all conditional transaction data flags cleanly.
     */
    static rehydrate(persistenceModel) {
        return new Payment({
            id: persistenceModel.id,
            tenantId: persistenceModel.tenantId,
            bookingId: persistenceModel.bookingId,
            amount: persistenceModel.amount,
            currency: persistenceModel.currency,
            gateway: persistenceModel.gateway,
            email: persistenceModel.email,
            userId: persistenceModel.userId,
            idempotencyKey: persistenceModel.idempotencyKey,
            externalReference: persistenceModel.externalReference,
            checkoutUrl: persistenceModel.checkoutUrl,
            status: persistenceModel.status,
            failureReason: persistenceModel.failureReason,
            refundedAmount: persistenceModel.refundedAmount ?? 0,
            gatewayTransactionId: persistenceModel.gatewayTransactionId ?? null,
            paidAt: persistenceModel.paidAt ?? null,
            cancelledReason: persistenceModel.cancelledReason ?? null,
            cancelledBy: persistenceModel.cancelledBy ?? null,
            cancelledAt: persistenceModel.cancelledAt ?? null,
            createdBy: persistenceModel.createdBy,
            createdAt: persistenceModel.createdAt,
            updatedAt: persistenceModel.updatedAt
        });
    }

    // -------------------------------------------------------------------------
    // Read-only Properties
    // -------------------------------------------------------------------------

    get id() { return this._id; }
    get tenantId() { return this._tenantId; }
    get bookingId() { return this._bookingId; }
    get amount() { return this._money.amount; }
    get currency() { return this._money.currency; }
    get money() { return this._money; }
    get gateway() { return this._gateway; }
    get email() { return this._email; }
    get userId() { return this._userId; }
    get idempotencyKey() { return this._idempotencyKey; }
    get status() { return this._status.value; }
    get externalReference() { return this._externalReference; }
    get checkoutUrl() { return this._checkoutUrl; }
    get failureReason() { return this._failureReason; }
    get refundedAmount() { return this._refundedAmount; }
    get gatewayTransactionId() { return this._gatewayTransactionId; }
    get paidAt() { return this._paidAt; }
    get cancelledReason() { return this._cancelledReason; }
    get cancelledBy() { return this._cancelledBy; }
    get cancelledAt() { return this._cancelledAt; }
    get createdBy() { return this._createdBy; }
    get createdAt() { return this._createdAt; }
    get updatedAt() { return this._updatedAt; }

    // -------------------------------------------------------------------------
    // Domain Invariants & State Guards
    // -------------------------------------------------------------------------

    isPending() { return this.status === PaymentStatus.CREATED; }
    isGatewayInitialized() { return this.status === PaymentStatus.GATEWAY_INITIALIZED; }
    isSuccessful() { return this.status === PaymentStatus.SUCCESSFUL; }
    isFailed() { return this.status === PaymentStatus.FAILED; }
    isCancelled() { return this.status === PaymentStatus.CANCELLED; }
    isRefunded() { return this.status === PaymentStatus.REFUNDED; }
    isPartiallyRefunded() { return this.status === PaymentStatus.PARTIALLY_REFUNDED; }

    canTransitionTo(targetStatus) {
        const transitions = {
            [PaymentStatus.CREATED]: [PaymentStatus.GATEWAY_INITIALIZED, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
            [PaymentStatus.GATEWAY_INITIALIZED]: [PaymentStatus.SUCCESSFUL, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
            [PaymentStatus.SUCCESSFUL]: [PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
            [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
            [PaymentStatus.FAILED]: [],
            [PaymentStatus.CANCELLED]: [],
            [PaymentStatus.REFUNDED]: []
        };
        return transitions[this.status]?.includes(targetStatus) ?? false;
    }

    canBeRefunded() {
        return this.isSuccessful() || this.isPartiallyRefunded();
    }

    // -------------------------------------------------------------------------
    // State Transitions
    // -------------------------------------------------------------------------

    markGatewayInitialized({ externalReference, checkoutUrl, updatedAt = new Date() }) {
        if (!this.canTransitionTo(PaymentStatus.GATEWAY_INITIALIZED)) {
            throw new UnprocessableEntityError(`Cannot initialize gateway while payment is '${this.status}'.`);
        }
        if (!externalReference) {
            throw new ValidationError("Gateway external reference is required.");
        }

        this._externalReference = externalReference;
        this._checkoutUrl = checkoutUrl ?? null;
        this._status = new PaymentStatus(PaymentStatus.GATEWAY_INITIALIZED);
        this._updatedAt = updatedAt;

        this.addDomainEvent({
            type: "payment.gateway.initialized",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                tenantId: this.tenantId,
                externalReference,
                gateway: this.gateway
            }
        });
        return this;
    }

    markInitializationFailed({ message, code, provider, updatedAt = new Date() }) {
        if (!this.canTransitionTo(PaymentStatus.FAILED)) {
            throw new UnprocessableEntityError(`Cannot fail payment while status is '${this.status}'.`);
        }

        this._status = new PaymentStatus(PaymentStatus.FAILED);
        this._failureReason = { message, code, provider };
        this._updatedAt = updatedAt;

        this.addDomainEvent({
            type: "payment.gateway.initialization.failed",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                tenantId: this.tenantId,
                gateway: provider,
                reason: message,
                code
            }
        });
        return this;
    }

    markSuccessful({ gatewayTransactionId, paidAt = new Date() } = {}) {
        if (!this.canTransitionTo(PaymentStatus.SUCCESSFUL)) {
            throw new UnprocessableEntityError(`Cannot complete payment while status is '${this.status}'.`);
        }

        this._status = new PaymentStatus(PaymentStatus.SUCCESSFUL);
        this._paidAt = paidAt;
        if (gatewayTransactionId) {
            this._gatewayTransactionId = gatewayTransactionId;
        }
        this._updatedAt = paidAt;

        this.addDomainEvent({
            type: "payment.completed",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                tenantId: this.tenantId,
                amount: this.amount,
                currency: this.currency,
                gatewayTransactionId: this._gatewayTransactionId
            }
        });
        return this;
    }

    markFailed({ message, code, provider, updatedAt = new Date() }) {
        if (!this.canTransitionTo(PaymentStatus.FAILED)) {
            throw new UnprocessableEntityError(`Cannot fail payment while status is '${this.status}'.`);
        }

        this._status = new PaymentStatus(PaymentStatus.FAILED);
        this._failureReason = { message, code, provider };
        this._updatedAt = updatedAt;

        this.addDomainEvent({
            type: "payment.failed",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                tenantId: this.tenantId,
                gateway: provider,
                reason: message
            }
        });
        return this;
    }

    cancel({ reason, cancelledBy, updatedAt = new Date() } = {}) {
        if (!this.canTransitionTo(PaymentStatus.CANCELLED)) {
            throw new UnprocessableEntityError(`Cannot cancel payment while status is '${this.status}'.`);
        }

        this._status = new PaymentStatus(PaymentStatus.CANCELLED);
        this._cancelledReason = reason ?? null;
        this._cancelledBy = cancelledBy ?? null;
        this._cancelledAt = updatedAt;
        this._updatedAt = updatedAt;

        this.addDomainEvent({
            type: "payment.cancelled",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                tenantId: this.tenantId,
                reason
            }
        });
        return this;
    }

    applyRefund({ amount, gatewayRefundId, processedBy, processedAt = new Date() }) {
        if (!this.canBeRefunded()) {
            throw new ValidationError("This payment is not eligible for a refund.");
        }
        if (amount <= 0 || (this._refundedAmount + amount) > this.amount) {
            throw new ValidationError("Invalid refund amount.");
        }

        this._refundedAmount += amount;
        
        const targetStatus = this._refundedAmount >= this.amount 
            ? PaymentStatus.REFUNDED 
            : PaymentStatus.PARTIALLY_REFUNDED;
            
        this._status = new PaymentStatus(targetStatus);
        this._updatedAt = processedAt;

        this.addDomainEvent({
            type: "PaymentRefunded",
            aggregateId: this.id,
            occurredAt: this.updatedAt,
            payload: {
                paymentId: this.id,
                amount,
                gatewayRefundId,
                processedBy,
                status: this.status
            }
        });
        return this;
    }

    // -------------------------------------------------------------------------
    // Event & Helper Utilities
    // -------------------------------------------------------------------------

    gatewayMetadata() {
        return {
            paymentId: this.id,
            bookingId: this.bookingId,
            tenantId: this.tenantId,
            gateway: this.gateway
        };
    }

    belongsToTenant(tenantId) { return this.tenantId === tenantId; }
    belongsToUser(userId) { return this.userId === userId; }
    wasCreatedBy(userId) { return this.createdBy === userId; }

    addDomainEvent(event) {
        this._domainEvents.push(Object.freeze(event));
    }

    pullDomainEvents() {
        const events = [...this._domainEvents];
        this._domainEvents.length = 0;
        return events;
    }

    toResponse() {
        return Object.freeze({
            id: this.id,
            bookingId: this.bookingId,
            tenantId: this.tenantId,
            gateway: this.gateway,
            amount: this.amount,
            currency: this.currency,
            email: this.email,
            status: this.status,
            externalReference: this._externalReference,
            checkoutUrl: this._checkoutUrl,
            refundedAmount: this._refundedAmount,
            gatewayTransactionId: this._gatewayTransactionId,
            paidAt: this._paidAt,
            createdAt: this._createdAt,
            updatedAt: this._updatedAt
        });
    }
}