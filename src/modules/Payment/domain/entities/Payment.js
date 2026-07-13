import { AggregateRoot } from "../../../../Shared/domain/AggregateRoot.js";
import { Money } from "../value-objects/Money.js";
import { PaymentStatus } from "../value-objects/PaymentStatus.js";
import { PaymentCreatedEvent } from "../events/PaymentCreatedEvent.js";
import { PaymentSuccessfulEvent } from "../events/PaymentSuccessfulEvent.js";
// ...

export class Payment extends AggregateRoot { // Inherit
    constructor(props) {
        super(props.id, props.version); // base handles id + version + events
        
        this._tenantId = props.tenantId;
        this._contextId = props.contextId; // was bookingId
        this._contextType = props.contextType; // 'booking', 'order', 'escrow'
        this._money = new Money(props.amount, props.currency);
        this._status = new PaymentStatus(props.status);
        // ... rest
    }

    static create(cmd) {
        // no default createdAt = new Date()
        if (!cmd.createdAt) throw new ValidationError("createdAt required");
        
        const payment = new Payment({
            id: cmd.id,
            version: 0, // new aggregate starts at 0
            tenantId: cmd.tenantId,
            contextId: cmd.contextId,
            contextType: cmd.contextType,
            amount: cmd.amount,
            currency: cmd.currency,
            status: PaymentStatus.CREATED,
            // ...
        });

        payment.addDomainEvent(
            new PaymentCreatedEvent({ // real DomainEvent, not plain object
                paymentId: payment.id,
                // ...
                correlationId: cmd.correlationId
            })
        );

        return payment;
    }

    markSuccessful({ gatewayTransactionId, paidAt }) {
        if (this.isSuccessful()) return this; // idempotent
        
        if (!this.canTransitionTo(PaymentStatus.SUCCESSFUL)) {
            throw new UnprocessableEntityError(`Cannot complete payment while status is '${this.status}'.`);
        }

        this._status = new PaymentStatus(PaymentStatus.SUCCESSFUL);
        this._paidAt = paidAt;
        this._gatewayTransactionId = gatewayTransactionId;
        this._incrementVersion(); // from base class
        this._updatedAt = paidAt;

        this.addDomainEvent(new PaymentSuccessfulEvent({ // not plain object
            paymentId: this.id,
            tenantId: this.tenantId,
            amount: this.amount,
            currency: this.currency,
            gatewayTransactionId,
            correlationId: this.currentCorrelationId // from base
        }));
        return this;
    }

    // remove addDomainEvent, pullDomainEvents, _domainEvents
    // base class provides them
}