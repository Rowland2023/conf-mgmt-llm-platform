// domain/value-objects/Money.js
import { ValidationError } from '../errors/PaymentErrors.js';

export class Money {
  constructor(amount, currency) {
    // 1. Strict Primitives & Bounds Validation
    if (!Number.isInteger(amount) || amount < 0) {
      throw new ValidationError("Domain rule violation: Monetary values must be non-negative integers in minor units.");
    }
    
    if (!currency || typeof currency !== 'string' || currency.length !== 3) {
      throw new ValidationError("Domain rule violation: Currency must match standard ISO 3-letter string formats.");
    }

    this._amount = amount;
    this._currency = currency.toUpperCase();
    
    // Enforce deep structural data immutability
    Object.freeze(this);
  }

  get amount() { return this._amount; }
  get currency() { return this._currency; }

  // --- Core Immutability Operation Encapsulations ---

  add(otherMoney) {
    this._assertSameCurrency(otherMoney);
    return new Money(this._amount + otherMoney.amount, this._currency);
  }

  subtract(otherMoney) {
    this._assertSameCurrency(otherMoney);
    if (this._amount - otherMoney.amount < 0) {
      throw new ValidationError("Domain arithmetic error: Resulting monetary balance operation cannot fall below zero.");
    }
    return new Money(this._amount - otherMoney.amount, this._currency);
  }

  // --- Clear Logical Assertions ---

  equals(otherMoney) {
    if (!(otherMoney instanceof Money)) return false;
    return this._amount === otherMoney.amount && this._currency === otherMoney.currency;
  }

  isGreaterThan(otherMoney) {
    this._assertSameCurrency(otherMoney);
    return this._amount > otherMoney.amount;
  }

  isGreaterThanOrEqual(otherMoney) {
    this._assertSameCurrency(otherMoney);
    return this._amount >= otherMoney.amount;
  }

  isZero() {
    return this._amount === 0;
  }

  // --- Private Safety Assertions ---

  _assertSameCurrency(other) {
    if (!other || this._currency !== other.currency) {
      throw new ValidationError(`Currency structural mismatch: Cannot compute across ${this._currency} and ${other?.currency || 'UNKNOWN'}`);
    }
  }

  multiply(multiplier) {
  if (typeof multiplier!== 'number' || multiplier < 0) {
    throw new ValidationError("Multiplier must be non-negative number");
  }
  return new Money(Math.round(this._amount * multiplier), this._currency);
}

// Split 100 into 3: [34, 33, 33], not [33.33, 33.33, 33.33]
allocate(ratios) {
  if (!Array.isArray(ratios) || ratios.length === 0) {
    throw new ValidationError("Ratios must be non-empty array");
  }
  const total = ratios.reduce((a, b) => a + b, 0);
  if (total === 0) throw new ValidationError("Ratio sum cannot be zero");

  const results = [];
  let remainder = this._amount;

  for (let i = 0; i < ratios.length - 1; i++) {
    const share = Math.floor(this._amount * ratios[i] / total);
    results.push(new Money(share, this._currency));
    remainder -= share;
  }
  results.push(new Money(remainder, this._currency)); // last gets remainder
  return results;
}

}