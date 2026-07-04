import { 
  ValidationError, 
  NotFoundError, 
  UnprocessableEntityError,
  GatewayError 
} from "../../domain/errors/PaymentErrors.js";

export class RefundPaymentUseCase {
  constructor({ paymentRepository, paymentGateway, logger, clock, idGenerator, lockManager }) {
    this.paymentRepository = paymentRepository;
    this.paymentGateway = paymentGateway;
    this.logger = logger;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.lockManager = lockManager; // Injected Redis or memory lock manager
  }

  async execute(command) {
    const { paymentId, amount, requestedBy, currentUser } = command;

    if (!paymentId) {
      throw new ValidationError("Refund execution failed: Target payment identity ID is required.");
    }

    // Acquire lock immediately to completely eliminate multi-request concurrency exploits
    const lockKey = `lock:refund:${paymentId}`;
    const lockAcquired = await this.lockManager.acquire(lockKey, { ttl: 10000 }); // 10s max lock timeout
    if (!lockAcquired) {
      throw new UnprocessableEntityError("A request for this transaction modification is already being processed. Please retry.");
    }

    try {
      // 1. Locate Initial Ledger Entry
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError(`Refund rejected: Payment transaction does not exist.`);
      }

      // Enforce multi-tenancy rules
      const isAdmin = currentUser?.role === 'admin';
      const isSameTenant = currentUser?.tenantId && payment.tenantId === currentUser.tenantId;
      const isOwner = payment.email === currentUser?.email || payment.userId === currentUser?.id;
      
      if (!isOwner && !isSameTenant && !isAdmin) {
        throw new NotFoundError(`Refund rejected: Payment transaction does not exist.`);
      }

      // 2. Verify Operational Status Eligibility
      if (!payment.canBeRefunded()) {
        throw new UnprocessableEntityError(
          `Refund rejected: Cannot reverse funds for a transaction with status '${payment.status}'.`
        );
      }

      // 3. Cumulative Over-Refund Prevention Guardrail
      const totalAlreadyRefunded = await this.paymentRepository.getSumOfRefundsByPaymentId(paymentId);
      
      // Fixed: Use ?? to ensure an explicit 0 is caught as a validation error instead of defaulting to full-refund
      const targetRefundAmount = amount ?? (payment.amount - totalAlreadyRefunded);

      if (!Number.isInteger(targetRefundAmount) || targetRefundAmount <= 0) {
        throw new ValidationError("Refund amount must be a positive integer in the lowest currency unit.");
      }

      if ((totalAlreadyRefunded + targetRefundAmount) > payment.amount) {
        throw new UnprocessableEntityError(
          `Operational failure: Requested refund amount of ${targetRefundAmount} exceeds the remaining refundable balance.`
        );
      }

      // 4. Isolate Third-Party Gateway Network Latency
      let providerRefund;
      try {
        providerRefund = await this.paymentGateway.refund({
          externalReference: payment.externalReference,
          amount: targetRefundAmount,
          currency: payment.currency
        });
      } catch (gatewayError) {
        this.logger.error(`Gateway refund rejection for Payment ID [${paymentId}]:`, gatewayError);
        throw new GatewayError(`Payment provider declined refund request: ${gatewayError.message}`);
      }

      // 5. Mutate and Persist State and Append-Only Logs
      try {
        const finalRemainingBalance = payment.amount - (totalAlreadyRefunded + targetRefundAmount);
        payment.applyRefundState(finalRemainingBalance);

        const refundLogId = this.idGenerator.generate();
        
        await this.paymentRepository.executeTransaction(async (trx) => {
          await this.paymentRepository.createRefundLog({
            id: refundLogId,
            originalPaymentId: payment.id,
            tenantId: payment.tenantId,
            amount: targetRefundAmount,
            externalRefundId: providerRefund.id,
            processedBy: requestedBy,
            createdAt: this.clock.now()
          }, { useTransaction: trx });

          await this.paymentRepository.update(payment, { useTransaction: trx });
        });

        return {
          success: true,
          refundId: refundLogId,
          status: payment.status,
          amountRefunded: targetRefundAmount,
          remainingRefundableBalance: finalRemainingBalance
        };

      } catch (dbError) {
        this.logger.error(
          `CRITICAL FINANCIAL MISMATCH: Refund successfully settled via gateway (Provider Ref: ${providerRefund.id}) for Payment ID [${payment.id}], but local system synchronization failed. Manual reconciliation required immediately.`,
          dbError
        );
        
        return {
          success: true,
          gatewayRefundId: providerRefund.id,
          status: 'SYNC_PENDING',
          amountRefunded: targetRefundAmount
        };
      }
    } finally {
      // Ensure lock is always cleared out regardless of success or throwing errors
      await this.lockManager.release(lockKey);
    }
  }
}