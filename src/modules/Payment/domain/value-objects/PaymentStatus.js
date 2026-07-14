// domain/value-objects/PaymentStatus.js
import { ValidationError, InternalError } from '../errors/PaymentErrors.js';

const VALID_STATUSES = Object.freeze(new Set([
  'PENDING', 
  'GATEWAY_INITIALIZED', 
  'SUCCESSFUL', 
  'HELD',           // <-- ADDED: funds captured, in escrow
  'RELEASED',       // <-- ADDED: funds paid to seller - terminal
  'FAILED', 
  'PARTIALLY_REFUNDED', 
  'REFUNDED',
  'CANCELED'
]));

// Escrow flow: PENDING -> GATEWAY_INITIALIZED -> SUCCESSFUL -> HELD -> RELEASED
// Direct flow: PENDING -> GATEWAY_INITIALIZED -> SUCCESSFUL
const TRANSITION_MAP = Object.freeze({
  'PENDING': Object.freeze(['GATEWAY_INITIALIZED', 'FAILED', 'CANCELED']),
  'GATEWAY_INITIALIZED': Object.freeze(['SUCCESSFUL', 'FAILED', 'CANCELED']),
  'SUCCESSFUL': Object.freeze(['HELD', 'PARTIALLY_REFUNDED', 'REFUNDED']), // can go to escrow
  'HELD': Object.freeze(['RELEASED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELED']), // escrow can release or refund
  'RELEASED': Object.freeze([]), // terminal - money gone
  'PARTIALLY_REFUNDED': Object.freeze(['REFUNDED', 'RELEASED']), // can fully refund or release remainder
  'FAILED': Object.freeze([]),
  'REFUNDED': Object.freeze([]),
  'CANCELED': Object.freeze([])
});

export class PaymentStatus {
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new ValidationError("PaymentStatus must be a non-empty string");
    }

    const upperValue = value.toUpperCase();
    if (!VALID_STATUSES.has(upperValue)) {
      throw new ValidationError(`Invalid payment status: '${value}'`);
    }

    this._value = upperValue;
    Object.freeze(this);
  }

  static fromDb(value) {
    try {
      return new PaymentStatus(value);
    } catch (e) {
      throw new InternalError(`Corrupt payment status in database: ${value}`, { cause: e });
    }
  }

  get value() { return this._value; }

  isTransitionAllowedTo(nextStatus) {
    const targetValue = nextStatus instanceof PaymentStatus ? nextStatus.value : nextStatus;
    if (!targetValue || typeof targetValue !== 'string') return false;
    
    const upperTarget = targetValue.toUpperCase();
    const allowed = TRANSITION_MAP[this._value] || [];
    return allowed.includes(upperTarget);
  }

  assertTransitionTo(nextStatus) {
    if (!this.isTransitionAllowedTo(nextStatus)) {
      const target = nextStatus instanceof PaymentStatus ? nextStatus.value : nextStatus;
      throw new ValidationError(`Invalid state transition: ${this._value} → ${target}`);
    }
  }

  // Predicates
  isPending() { return this._value === 'PENDING'; }
  isGatewayInitialized() { return this._value === 'GATEWAY_INITIALIZED'; }
  isSuccessful() { return this._value === 'SUCCESSFUL'; }
  isHeld() { return this._value === 'HELD'; } // <-- ADDED
  isReleased() { return this._value === 'RELEASED'; } // <-- ADDED
  isFailed() { return this._value === 'FAILED'; }
  isPartiallyRefunded() { return this._value === 'PARTIALLY_REFUNDED'; }
  isRefunded() { return this._value === 'REFUNDED'; }
  isCanceled() { return this._value === 'CANCELED'; }

  // Convenience
  isTerminal() {
    return this.isFailed() || this.isRefunded() || this.isCanceled() || this.isReleased(); // RELEASED is terminal
  }

  isSettled() {
    return this.isSuccessful() || this.isHeld() || this.isPartiallyRefunded() || this.isRefunded() || this.isReleased();
  }

  equals(other) {
    return other instanceof PaymentStatus && this._value === other.value;
  }

  toString() {
    return this._value;
  }
}