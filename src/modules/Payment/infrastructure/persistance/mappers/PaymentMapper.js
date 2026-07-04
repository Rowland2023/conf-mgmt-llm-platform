import { Payment } from '../../../domain/entities/Payment.js';
import { PaymentStatus } from '../../../domain/value-objects/PaymentStatus.js';
import { InternalError } from '../../../domain/errors/PaymentErrors.js';

export class PaymentMapper {
  static toDomain(raw) {
    if (!raw) return null;
    if (!raw.id) throw new InternalError('Payment row missing ID');

    const amount = Number(raw.amount);
    // Prevents fractional amounts, negative balances, and NaN edge cases
    if (!Number.isInteger(amount) || amount < 0) {
      throw new InternalError(`Invalid amount in DB: ${raw.amount}`);
    }

    return new Payment({
      id: raw.id,
      tenantId: raw.tenant_id ?? null,
      bookingId: raw.booking_id,
      amount,
      currency: raw.currency, 
      status: PaymentStatus.fromDb(raw.status), 
      email: raw.email ?? null, // Let the domain layer handle formatting/validation
      userId: raw.user_id ?? null,
      externalReference: raw.external_reference ?? null,
      
      // Defensively parse only if it's a string; otherwise use the driver's Date object
      createdAt: raw.created_at ? new Date(raw.created_at) : null,
      updatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
      
      // If your driver automatically parses JSONB, this is an object. If not, parse it.
      errorDetails: typeof raw.error_details === 'string' 
        ? JSON.parse(raw.error_details) 
        : (raw.error_details ?? null)
    });
  }

  static toPersistence(entity) {
    if (!entity) return null;

    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      booking_id: entity.bookingId,
      amount: entity.amount,
      currency: entity.currency,
      status: entity.status.value, 
      email: entity.email,
      user_id: entity.userId,
      external_reference: entity.externalReference,
      
      // NOTE: Remove JSON.stringify() if your ORM/DB driver handles jsonb native objects!
      error_details: entity.errorDetails ?? null, 
      
      // Let your DB client handle Date object conversion natively to preserve timezone contexts
      created_at: entity.createdAt ?? null,
      updated_at: entity.updatedAt ?? null
    };
  }
}