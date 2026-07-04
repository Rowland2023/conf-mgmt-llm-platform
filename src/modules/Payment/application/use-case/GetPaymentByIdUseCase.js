// application/use-cases/GetPaymentByIdUseCase.js

import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError // Added to match your 401 intention
} from "../../domain/errors/PaymentErrors.js";

export class GetPaymentByIdUseCase {
  constructor({ paymentRepository }) {
    this.paymentRepository = paymentRepository;
  }

  async execute(command) {
    const { id, currentUser } = command;

    // 1. Strict Structural Parameters Guard
    if (!id) {
      throw new ValidationError("Payment lookup failed: Payment identity ID parameter is mandatory.");
    }
    if (!currentUser) {
      // Clean mapping: Yields a proper 401 downstream instead of a 400 validation error
      throw new UnauthorizedError("Unauthorized access: Authenticated user context missing.");
    }

    // 2. Fetch Entity from Database Abstraction
    const payment = await this.paymentRepository.findById(id);
    
    // 3. Robust Business Authorization Rules & Enumeration Guard
    if (!payment) {
      throw new NotFoundError(`Transaction query failed: No payment records matched ID.`);
    }

    const isAdmin = currentUser.role === 'admin';
    const isIndividualOwner = payment.email === currentUser.email || payment.userId === currentUser.id;
    const isSameTenantOwner = currentUser.tenantId && payment.tenantId === currentUser.tenantId;

    if (!isIndividualOwner && !isSameTenantOwner && !isAdmin) {
      // Secure Context Masking: Deny visibility to hide resource existence entirely
      throw new NotFoundError(`Transaction query failed: No payment records matched ID.`);
    }

    // 4. Pure Clean Architecture Serialization Boundary Protection
    return payment.toResponse();
  }
}