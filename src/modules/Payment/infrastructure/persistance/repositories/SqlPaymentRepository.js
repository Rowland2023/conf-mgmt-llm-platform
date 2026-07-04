import { PaymentMapper } from '../mappers/PaymentMapper.js';
import { PaymentRefundMapper } from '../mappers/PaymentRefundMapper.js';
import { InternalError } from '../../../domain/errors/PaymentErrors.js';

export class SqlPaymentRepository {
  constructor({ dbContext }) {
    this.db = dbContext;
  }

  async findById(id) {
    if (!id) throw new InternalError('ID required for payment lookup');
    
    const row = await this.db('payments').where({ id }).first();
    return PaymentMapper.toDomain(row);
  }

  /**
   * Pessimistically locks the payment row for modifications.
   * Parameter default `{}` prevents destructuring crashes if the options arg is omitted.
   */
  async findByIdForUpdate(id, { useTransaction } = {}) {
    if (!useTransaction) throw new InternalError('findByIdForUpdate requires an active transaction');
    if (!id) throw new InternalError('ID required for locked payment lookup');

    const row = await useTransaction('payments').where({ id }).forUpdate().first();
    return PaymentMapper.toDomain(row);
  }

  async getSumOfRefundsByPaymentId(paymentId, { useTransaction } = {}) {
    const client = useTransaction || this.db;
    
    const result = await client('payment_refund_logs')
      .where({ original_payment_id: paymentId })
      .sum('amount as total')
      .first();

    // SQL SUM() returns null if zero rows match. Nullish coalescing covers both null and undefined.
    const totalRaw = result?.total;
    if (totalRaw ?? null === null) return 0;

    const total = Number(totalRaw);
    if (!Number.isInteger(total) || total < 0) {
      throw new InternalError(`Corrupt refund sum for payment ${paymentId}: ${totalRaw}`);
    }

    return total;
  }

  async createRefundLog(logData, { useTransaction } = {}) {
    const client = useTransaction || this.db;
    
    // Direct key mapping setup optimized for database indexing
    const dbPayload = {
      id: logData.id,
      idempotency_key: logData.idempotencyKey,
      original_payment_id: logData.originalPaymentId,
      tenant_id: logData.tenantId,
      amount: logData.amount,
      external_refund_id: logData.externalRefundId,
      status: logData.status,
      processed_by: logData.processedBy,
      created_at: logData.createdAt
    };

    const [row] = await client('payment_refund_logs').insert(dbPayload).returning('*');
    return PaymentRefundMapper.toDomain(row);
  }

  async update(paymentEntity, { useTransaction } = {}) {
    const client = useTransaction || this.db;
    const dbPayload = PaymentMapper.toPersistence(paymentEntity);

    const affectedRows = await client('payments')
      .where({ id: paymentEntity.id })
      .update(dbPayload);

    if (affectedRows === 0) {
      throw new InternalError(`Payment ${paymentEntity.id} not found for update or no data changed`);
    }
  }

  /**
   * Safely wraps database operations inside an atomic transaction block.
   */
  async executeTransaction(actionBlock) {
    return await this.db.transaction(async (trx) => {
      return await actionBlock(trx);
    });
  }
}