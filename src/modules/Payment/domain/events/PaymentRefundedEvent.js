// domain/events/PaymentRefundedEvent.js
import { ValidationError } from '../errors/PaymentErrors.js';

export class PaymentRefundedEvent {
  /**
   * @param {Object} props
   * @param {string} props.id - A unique identifier for this specific event instance (UUID v4)
   * @param {string} props.paymentId - The domain aggregate root identifier
   * @param {string} props.bookingId - The linked operational booking identifier
   * @param {string} [props.tenantId] - Optional corporate tenant group identifier (or null for individual commuters) [cite: 1]
   * @param {number} props.amountRefunded - The specific integer amount reversed in the minor currency unit
   * @param {number} props.remainingBalance - The remaining refundable pool balance on the aggregate root
   * @param {string} props.currency - Standard ISO 3-letter currency code (e.g., 'NGN', 'USD')
   * @param {string} props.status - The updated status of the payment entity ('PARTIALLY_REFUNDED' or 'REFUNDED')
   * @param {string} props.processedBy - Identity or service account token that initiated the reversal
   * @param {Date} [props.occurredAt] - Clock timestamp tracking exact domain execution
   */
  constructor({ id, paymentId, bookingId, tenantId, amountRefunded, remainingBalance, currency, status, processedBy, occurredAt }) {
    // 1. Strict Event Contract Constraints Validation
    if (!id || typeof id !== 'string') {
      throw new ValidationError("Domain Event Error: Unique event tracking ID is required.");
    }
    if (!paymentId || typeof paymentId !== 'string') {
      throw new ValidationError("Domain Event Error: Target payment aggregate root linkage ID is required.");
    }
    if (!bookingId || typeof bookingId !== 'string') {
      throw new ValidationError("Domain Event Error: Reference booking identifier linkage is required.");
    }
    if (!Number.isInteger(amountRefunded) || amountRefunded <= 0) {
      throw new ValidationError("Domain Event Error: Amount refunded must be a positive integer in minor units.");
    }
    if (!Number.isInteger(remainingBalance) || remainingBalance < 0) {
      throw new ValidationError("Domain Event Error: Remaining balance calculation must be a non-negative integer.");
    }
    if (!currency || typeof currency !== 'string' || currency.length !== 3) {
      throw new ValidationError("Domain Event Error: Valid ISO 3-letter currency profile is required.");
    }
    if (!['PARTIALLY_REFUNDED', 'REFUNDED'].includes(status)) {
      throw new ValidationError(`Domain Event Error: Invalid post-reversal execution status context: '${status}'`);
    }
    if (!processedBy) {
      throw new ValidationError("Domain Event Error: Audit trail requires tracking the identity behind the refund execution.");
    }

    // 2. Map Read-Only Metadata
    this.name = 'PaymentRefundedEvent';
    this.occurredAt = occurredAt instanceof Date ? occurredAt : new Date();
    
    // 3. Encapsulate Immutable State Payload 
    this.payload = Object.freeze({
      id,
      paymentId,
      bookingId,
      tenantId: tenantId || null, // Clear null matching for solo vs team logistics profiles [cite: 1]
      amountRefunded,
      remainingBalance,
      currency: currency.toUpperCase(),
      status,
      processedBy
    });

    // Lock the event wrapper entirely to preserve data integrity during in-memory bus transit
    Object.freeze(this);
  }
  
}