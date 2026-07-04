// domain/entities/Payment.js
import { Money } from '../value-objects/Money.js';
import { PaymentStatus } from '../value-objects/PaymentStatus.js';
import { ValidationError, UnprocessableEntityError } from '../errors/PaymentErrors.js';

export class Payment {
  // Use underscore naming conventions (or native # private fields) to guard boundaries
  constructor({ id, tenantId, bookingId, amount, currency, status, email, userId, externalReference, createdAt, updatedAt, errorDetails }) {
    this._id = id;
    this._tenantId = tenantId;
    this._bookingId = bookingId;
    
    // Encapsulate native primitives into immutably protected Domain Value Objects
    this._money = new Money(amount, currency);
    this._status = new PaymentStatus(status || 'PENDING');
    
    this._email = email;
    this._userId = userId;
    this._externalReference = externalReference;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || this._createdAt;
    this._errorDetails = errorDetails || null;
  }

  // Pure Domain Factory Method for capturing new booking transaction intents cleanly
  static create(props) {
    if (!props.id) throw new ValidationError("Domain Entity Error: Unique Identity ID is mandatory.");
    if (!props.bookingId) throw new ValidationError("Domain Entity Error: Booking reference linkage is mandatory.");
    if (!props.email) throw new ValidationError("Domain Entity Error: Valid customer notification email is mandatory.");
    
    return new Payment({
      ...props,
      status: 'PENDING',
      createdAt: new Date()
    });
  }

  // --- Strict Read-Only Getters to protect internal domain state mutations ---
  get id() { return this._id; }
  get bookingId() { return this._bookingId; }
  get tenantId() { return this._tenantId; }
  get amount() { return this._money.amount; }
  get currency() { return this._money.currency; }
  get email() { return this._email; }
  get userId() { return this._userId; }
  get status() { return this._status.value; }
  get externalReference() { return this._externalReference; }
  get errorDetails() { return this._errorDetails; }

  // --- Pure Domain Lifecycle State-Machine Transitions ---

  markGatewayInitialized(reference) {
    if (!reference) throw new ValidationError("Lifecycle Error: External gateway provider reference token cannot be empty.");
    if (this._status.value !== 'PENDING') {
      throw new UnprocessableEntityError(`Invalid Transition: Cannot open gateway initialization from state '${this._status.value}'`);
    }
    this._externalReference = reference;
    this._status = new PaymentStatus('GATEWAY_INITIALIZED');
    this._updatedAt = new Date();
  }

  markSuccessful() {
    const allowedSourceStates = ['PENDING', 'GATEWAY_INITIALIZED'];
    if (!allowedSourceStates.includes(this._status.value)) {
      throw new UnprocessableEntityError(`Invalid Transition: Cannot settle payment ledger from state '${this._status.value}'`);
    }
    this._status = new PaymentStatus('SUCCESSFUL');
    this._updatedAt = new Date();
  }

  markFailed(reason) {
    const unalterableStates = ['SUCCESSFUL', 'REFUNDED', 'CANCELED'];
    if (unalterableStates.includes(this._status.value)) {
      throw new UnprocessableEntityError(`Invalid Transition: Cannot modify finalized historical record status to FAILED from '${this._status.value}'`);
    }
    this._status = new PaymentStatus('FAILED');
    this._errorDetails = reason || "Unknown transactional exception logged.";
    this._updatedAt = new Date();
  }

  markCanceled() {
    if (this._status.value === 'SUCCESSFUL' || this._status.value === 'REFUNDED') {
      throw new UnprocessableEntityError(`Invalid Transition: Cannot void an active, completed transaction ledger from state '${this._status.value}'`);
    }
    this._status = new PaymentStatus('CANCELED');
    this._updatedAt = new Date();
  }

  canBeRefunded() {
    return this._status.value === 'SUCCESSFUL' || this._status.value === 'PARTIALLY_REFUNDED';
  }

  // Mutator enforcing domain state boundary transition rules safely
  applyRefundState(remainingBalanceAmount) {
    if (!this.canBeRefunded()) {
      throw new UnprocessableEntityError(`Cannot transition payment [${this._id}] from current state '${this._status.value}' to a refund reversal status.`);
    }

    if (remainingBalanceAmount === 0) {
      this._status = new PaymentStatus('REFUNDED');
    } else if (remainingBalanceAmount > 0) {
      this._status = new PaymentStatus('PARTIALLY_REFUNDED');
    } else {
      throw new UnprocessableEntityError("Domain Arithmetic Guard: Calculated remaining allocation refund balance cannot drop below zero.");
    }
    this._updatedAt = new Date();
  }

  // High-reliability payload metadata structure for passing downstream to financial gateways (Paystack/Stripe)
  gatewayMetadata() {
    return {
      paymentId: this._id,
      bookingId: this._bookingId,
      tenantId: this._tenantId || 'INDIVIDUAL_COMMUTER' // Differentiates single users from corporate transport groups
    };
  }

  // The Data Transfer Object (DTO) boundary serializer 
  // Freezing ensures read safety so that out-of-boundary controllers or presentational views cannot mutate fields
  toResponse() {
    return Object.freeze({
      id: this._id,
      tenantId: this._tenantId,
      bookingId: this._bookingId,
      amount: this._money.amount,
      currency: this._money.currency,
      status: this._status.value,
      email: this._email,
      externalReference: this._externalReference,
      createdAt: this._createdAt.toISOString()
    });
  }
}