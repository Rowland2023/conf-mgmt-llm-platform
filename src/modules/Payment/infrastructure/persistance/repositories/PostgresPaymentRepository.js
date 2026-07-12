// modules/payment/infrastructure/repositories/PostgresPaymentRepository.js

import { IPaymentRepository } from "../../../domain/repositories/IPaymentRepository.js";
import { ConflictError } from "../../../domain/errors/PaymentErrors.js";

export class PostgresPaymentRepository extends IPaymentRepository {
  constructor({ db, paymentMapper }) {
    super();
    this.db = db;
    this.paymentMapper = paymentMapper;
  }

  async save(payment, options = {}) {
    const client = options.transaction || this.db;

    const query = `
      INSERT INTO payments (
        id, booking_id, tenant_id, user_id, 
        amount, currency, status, gateway, 
        gateway_transaction_id, idempotency_key, 
        external_reference, checkout_url, failure_reason,
        refunded_amount, paid_at,
        cancelled_reason, cancelled_by, cancelled_at,
        created_by, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
    `;

    const values = [
      payment.id,
      payment.bookingId,
      payment.tenantId,
      payment.userId,
      payment.amount,         // Fixed: Primitive number integer (minor units)
      payment.currency,       // Fixed: Primitive currency string
      payment.status,
      payment.gateway,
      payment.gatewayTransactionId,
      payment.idempotencyKey,
      payment.externalReference,
      payment.checkoutUrl,
      payment.failureReason ? JSON.stringify(payment.failureReason) : null,
      payment.refundedAmount, // Fixed: Primitive number integer
      payment.paidAt,
      payment.cancelledReason,
      payment.cancelledBy,
      payment.cancelledAt,
      payment.createdBy,
      payment.createdAt,      // Fixed: Preserves exact domain instantiation time
      payment.updatedAt
    ];

    const result = await client.query(query, values);
    return this.paymentMapper.toDomain(result.rows[0]);
  }

  async findById(paymentId, options = {}) {
    const client = options.transaction || this.db;
    const query = `SELECT * FROM payments WHERE id = $1 LIMIT 1`;
    const result = await client.query(query, [paymentId]);

    return result.rows.length === 0 ? null : this.paymentMapper.toDomain(result.rows[0]);
  }

  async findByIdForUpdate(paymentId, transaction) {
    if (!transaction) {
      throw new Error("Pessimistic row locking requires an active database transaction connection reference.");
    }
    const query = `SELECT * FROM payments WHERE id = $1 FOR UPDATE`;
    const result = await transaction.query(query, [paymentId]);

    return result.rows.length === 0 ? null : this.paymentMapper.toDomain(result.rows[0]);
  }

  async findByIdempotencyKey(idempotencyKey, options = {}) {
    const client = options.transaction || this.db;
    const query = `SELECT * FROM payments WHERE idempotency_key = $1 LIMIT 1`;
    const result = await client.query(query, [idempotencyKey]);

    return result.rows.length === 0 ? null : this.paymentMapper.toDomain(result.rows[0]);
  }

  async findByGatewayTransactionId(gatewayTransactionId, options = {}) {
    const client = options.transaction || this.db;
    const query = `SELECT * FROM payments WHERE gateway_transaction_id = $1 LIMIT 1`;
    const result = await client.query(query, [gatewayTransactionId]);

    return result.rows.length === 0 ? null : this.paymentMapper.toDomain(result.rows[0]);
  }

  async update(payment, options = {}) {
    const client = options.transaction || this.db;

    // Fixed: Maps all changing lifecycle fields back to the schema
    const query = `
      UPDATE payments
      SET
        status = $2,
        gateway_transaction_id = $3,
        external_reference = $4,
        checkout_url = $5,
        failure_reason = $6,
        refunded_amount = $7,
        paid_at = $8,
        cancelled_reason = $9,
        cancelled_by = $10,
        cancelled_at = $11,
        updated_at = $12
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      payment.id,
      payment.status,
      payment.gatewayTransactionId,
      payment.externalReference,
      payment.checkoutUrl,
      payment.failureReason ? JSON.stringify(payment.failureReason) : null,
      payment.refundedAmount, // Fixed: Primitive number integer
      payment.paidAt,
      payment.cancelledReason,
      payment.cancelledBy,
      payment.cancelledAt,
      payment.updatedAt       // Uses domain-driven tracking updates
    ];

    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      throw new ConflictError(`Stale state execution: Payment aggregate with ID ${payment.id} not found or modification barred.`);
    }

    return this.paymentMapper.toDomain(result.rows[0]);
  }

  async exists(paymentId, options = {}) {
    const client = options.transaction || this.db;
    const query = `SELECT EXISTS(SELECT 1 FROM payments WHERE id = $1)`;
    const result = await client.query(query, [paymentId]);
    return result.rows[0].exists;
  }
}