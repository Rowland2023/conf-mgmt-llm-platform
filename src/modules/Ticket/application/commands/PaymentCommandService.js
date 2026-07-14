// src/modules/payment/application/services/PaymentCommandService.js
import { DomainError, OptimisticLockError } from '../../../shared/errors/index.js';
import { withRetry } from '../../../shared/utils/retry.js';

export class PaymentCommandService {
  #paymentRepository;
  #outboxRepository;
  #paymentGateway; // e.g., Paystack/Stripe wrapper
  #unitOfWork;
  #logger;

  constructor({ paymentRepository, outboxRepository, paymentGateway, unitOfWork, logger }) {
    this.#paymentRepository = paymentRepository;
    this.#outboxRepository = outboxRepository;
    this.#paymentGateway = paymentGateway;
    this.#unitOfWork = unitOfWork;
    this.#logger = logger;
  }

  /**
   * Processes an incoming payment request.
   * Leverages external PSP gateway and commits the result atomically with an Outbox event.
   */
  async processPayment({ orderId, amount, currency, paymentMethod, correlationId, idempotencyKey }) {
    const log = this.#logger.child({ correlationId, orderId, operation: 'processPayment' });

    return withRetry(async () => {
      return this.#unitOfWork.execute(async (trx) => {
        // 1. Idempotency Check
        const existingPayment = await this.#paymentRepository.findByIdempotencyKey(idempotencyKey, trx);
        if (existingPayment) {
          log.info({ idempotencyKey }, 'Payment request already processed. Returning cached payment.');
          return existingPayment;
        }

        log.info({ amount, currency }, 'Initiating transaction charge with External Gateway');
        
        // 2. Charge External Provider (External IO is wrapped safely)
        let gatewayResult;
        try {
          gatewayResult = await this.#paymentGateway.charge({
            amount,
            currency,
            paymentMethod,
            metadata: { orderId, correlationId }
          });
        } catch (gatewayErr) {
          log.error({ err: gatewayErr }, 'External payment gateway transaction failed');
          throw new DomainError('GATEWAY_COMMUNICATION_ERROR', 'Payment gateway was unreachable. Please try again.', 502);
        }

        // 3. Evaluate Domain Invariant based on Gateway response
        const isSuccess = gatewayResult.status === 'SUCCESS';
        const paymentStatus = isSuccess ? 'COMPLETED' : 'FAILED';

        const paymentPayload = {
          id: crypto.randomUUID(),
          orderId,
          amount,
          currency,
          status: paymentStatus,
          transactionReference: gatewayResult.reference,
          errorMessage: isSuccess ? null : gatewayResult.failureReason,
          version: 1
        };

        // 4. Atomic Database Commits
        await this.#paymentRepository.save(paymentPayload, trx);
        await this.#paymentRepository.saveIdempotencyKey(idempotencyKey, paymentPayload.id, trx);

        // 5. Generate and queue appropriate Outbox event
        const paymentEvents = [{
          type: isSuccess ? 'payment.succeeded' : 'payment.failed',
          occurredAt: new Date(),
          aggregateId: paymentPayload.id,
          aggregateType: 'Payment',
          correlationId,
          payload: {
            paymentId: paymentPayload.id,
            orderId,
            amount,
            currency,
            transactionReference: gatewayResult.reference
          }
        }];

        await this.#outboxRepository.store(paymentEvents, trx);

        log.info({ paymentId: paymentPayload.id, status: paymentStatus }, 'Payment settled and outbox event stored.');
        return paymentPayload;
      });
    }, {
      retries: 3,
      onRetry: (err) => err instanceof OptimisticLockError
    });
  }
}