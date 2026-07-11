// modules/payment/domain/repositories/IPaymentRepository.js

export class IPaymentRepository {

  /**
   * Persist a new Payment aggregate.
   * 
   * @param {Payment} payment
   * @param {Object} options
   */
  async save(payment, options = {}) {
    throw new Error(
      "IPaymentRepository.save() must be implemented."
    );
  }


  /**
   * Retrieve payment aggregate by ID.
   * 
   * @param {string} paymentId
   * @returns {Promise<Payment|null>}
   */
  async findById(paymentId, options = {}) {
    throw new Error(
      "IPaymentRepository.findById() must be implemented."
    );
  }


  /**
   * Retrieve payment with database lock.
   * Used for:
   * - refunds
   * - state transitions
   * - concurrency protection
   *
   * @param {string} paymentId
   */
  async findByIdForUpdate(paymentId, transaction) {
    throw new Error(
      "IPaymentRepository.findByIdForUpdate() must be implemented."
    );
  }


  /**
   * Find payment using idempotency key.
   *
   * Prevents duplicate payment creation.
   *
   * @param {string} idempotencyKey
   */
  async findByIdempotencyKey(idempotencyKey, options = {}) {
    throw new Error(
      "IPaymentRepository.findByIdempotencyKey() must be implemented."
    );
  }


  /**
   * Find payment by gateway reference.
   *
   * Used by:
   * - Paystack webhook
   * - Stripe webhook
   *
   * @param {string} gatewayTransactionId
   */
  async findByGatewayTransactionId(
    gatewayTransactionId,
    options = {}
  ) {
    throw new Error(
      "IPaymentRepository.findByGatewayTransactionId() must be implemented."
    );
  }


  /**
   * Update existing payment aggregate.
   *
   * @param {Payment} payment
   */
  async update(payment, options = {}) {
    throw new Error(
      "IPaymentRepository.update() must be implemented."
    );
  }


  /**
   * Check existence without loading aggregate.
   *
   * Useful for fast validation.
   */
  async exists(paymentId, options = {}) {
    throw new Error(
      "IPaymentRepository.exists() must be implemented."
    );
  }
}