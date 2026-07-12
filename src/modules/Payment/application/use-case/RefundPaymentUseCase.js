import {
    ValidationError,
    NotFoundError,
    GatewayError
} from "../../domain/errors/PaymentErrors.js";
import { RefundPaymentCommand } from "../../domain/commands/RefundPaymentCommand.js";

export class RefundPaymentUseCase {
    constructor({
        paymentRepository,
        refundRepository,
        outboxRepository,
        paymentGatewayFactory,
        lockManager,
        unitOfWork,
        idGenerator,
        clock,
        logger = console,
        metrics,
        auditLogger
    }) {
        if (!paymentRepository) throw new Error("RefundPaymentUseCase requires paymentRepository.");
        if (!refundRepository) throw new Error("RefundPaymentUseCase requires refundRepository.");
        if (!outboxRepository) throw new Error("RefundPaymentUseCase requires outboxRepository.");
        if (!paymentGatewayFactory) throw new Error("RefundPaymentUseCase requires paymentGatewayFactory.");
        if (!lockManager) throw new Error("RefundPaymentUseCase requires lockManager.");
        if (!unitOfWork) throw new Error("RefundPaymentUseCase requires unitOfWork.");
        if (!idGenerator) throw new Error("RefundPaymentUseCase requires idGenerator.");
        if (!clock) throw new Error("RefundPaymentUseCase requires clock.");

        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.outboxRepository = outboxRepository;
        this.paymentGatewayFactory = paymentGatewayFactory;
        this.lockManager = lockManager;
        this.unitOfWork = unitOfWork;
        this.idGenerator = idGenerator;
        this.clock = clock;
        this.logger = logger;
        this.metrics = metrics;
        this.auditLogger = auditLogger;
    }

    async execute(input) {
        const startedAt = Date.now();
        const command = new RefundPaymentCommand(input);
        const lockKey = `payment:refund:${command.paymentId}`;

        const acquired = await this.lockManager.acquire(lockKey, { ttl: 30000 });
        if (!acquired) {
            throw new ValidationError("Another refund execution for this payment is currently processing.");
        }

        try {
            // STEP 1: Reserve the balance and commit a PENDING intent record to the DB
            const { payment, refundRecord, refundAmount } = await this.#reserveAndCreateIntent(command);

            // STEP 2: Execute the external call safely knowing our intent is durable
            let gatewayRefund;
            try {
                gatewayRefund = await this.#executeGatewayRefund(payment, refundRecord, refundAmount);
            } catch (gatewayError) {
                // Hard failures mean the gateway definitively said NO. 
                // Timeouts/Network issues must leave the intent PENDING for reconciliation.
                if (gatewayError.isNetworkTimeout || gatewayError.statusCode === 504) {
                    this.logger.warn(
                        { refundRecordId: refundRecord.id, error: gatewayError.message },
                        "Refund request timed out. Leaving intent state as PENDING for automated reconciliation."
                    );
                } else {
                    await this.#markIntentFailed(refundRecord.id, gatewayError.message);
                }
                throw gatewayError;
            }

            // STEP 3: Settle the pending intent states to successful status fields
            const finalResult = await this.#settleRefundSuccess(payment.id, refundRecord.id, gatewayRefund, command);

            this.metrics?.increment?.("payment.refund.success");
            this.metrics?.histogram?.("payment.refund.duration", Date.now() - startedAt);

            await this.auditLogger?.record?.({
                action: "PAYMENT_REFUNDED",
                aggregateId: finalResult.payment.id,
                tenantId: finalResult.payment.tenantId,
                actorId: command.currentUser.id,
                occurredAt: this.clock.now(),
                metadata: {
                    refundId: finalResult.refund.id,
                    gatewayRefundId: gatewayRefund.id,
                    amount: finalResult.refund.amount
                }
            });

            return {
                success: true,
                paymentId: finalResult.payment.id,
                refundId: finalResult.refund.id,
                gatewayRefundId: gatewayRefund.id,
                status: finalResult.payment.status,
                amountRefunded: finalResult.refund.amount
            };

        } finally {
            await this.lockManager.release(lockKey);
        }
    }

    async #reserveAndCreateIntent(command) {
        return this.unitOfWork.execute(async (trx) => {
            const payment = await this.paymentRepository.findByIdForUpdate(command.paymentId, trx);
            if (!payment) throw new NotFoundError("Payment not found.");

            this.#authorize(payment, command.currentUser);

            if (!payment.canBeRefunded()) {
                throw new ValidationError("Payment cannot be refunded in its current state.");
            }

            const totalAlreadyRefunded = await this.paymentRepository.getSumOfRefundsByPaymentId(payment.id, trx);
            const refundAmount = command.amount ?? (payment.amount - totalAlreadyRefunded);

            if (refundAmount <= 0) throw new ValidationError("Refund amount must be greater than zero.");
            if (refundAmount > (payment.amount - totalAlreadyRefunded)) {
                throw new ValidationError("Refund exceeds remaining refundable balance.");
            }

            const refundRecord = {
                id: this.idGenerator.generate(),
                paymentId: payment.id,
                tenantId: payment.tenantId,
                amount: refundAmount,
                gateway: payment.gateway,
                status: "PENDING", 
                processedBy: command.currentUser.id,
                createdAt: this.clock.now()
            };

            await this.refundRepository.createRefund(refundRecord, trx);
            return { payment, refundRecord, refundAmount };
        });
    }

    async #executeGatewayRefund(payment, refundRecord, refundAmount) {
        const gateway = this.paymentGatewayFactory.create(payment.gateway);

        try {
            return await gateway.refund({
                externalReference: payment.externalReference,
                amount: refundAmount,
                currency: payment.currency,
                idempotencyKey: refundRecord.id, 
                metadata: {
                    paymentId: payment.id,
                    refundRecordId: refundRecord.id
                }
            });
        } catch (error) {
            const gatewayError = new GatewayError("Gateway rejected the refund request.", { cause: error });
            gatewayError.isNetworkTimeout = error.code === "ETIMEDOUT" || error.code === "ECONNRESET";
            gatewayError.statusCode = error.response?.status;
            throw gatewayError;
        }
    }

    async #settleRefundSuccess(paymentId, refundRecordId, gatewayRefund, command) {
        return this.unitOfWork.execute(async (trx) => {
            const payment = await this.paymentRepository.findByIdForUpdate(paymentId, trx);
            const refund = await this.refundRepository.findByIdForUpdate(refundRecordId, trx);

            if (!payment || !refund) {
                throw new NotFoundError("Payment or intent record missing during settlement.");
            }

            // Defensively recalculate active balances within the terminal transaction boundary
            const currentHistoricalRefunds = await this.paymentRepository.getSumOfRefundsByPaymentId(payment.id, trx);
            
            // Exclude our current pending intent amount from history calculation if your repository counting logic already includes it
            if (refund.amount > (payment.amount - currentHistoricalRefunds + refund.amount)) {
                throw new ValidationError("Terminal integrity check failed: Refund exceeds remaining refundable balance.");
            }

            payment.applyRefund({
                amount: refund.amount,
                gatewayRefundId: gatewayRefund.id,
                processedBy: command.currentUser.id,
                processedAt: this.clock.now()
            });

            refund.status = "SUCCESSFUL";
            refund.gatewayRefundId = gatewayRefund.id;

            await this.paymentRepository.update(payment, trx);
            await this.refundRepository.update(refund, trx);

            for (const event of payment.pullDomainEvents()) {
                await this.outboxRepository.save(event, trx);
            }

            return { payment, refund };
        });
    }

    async #markIntentFailed(refundRecordId, errorReason) {
        try {
            await this.unitOfWork.execute(async (trx) => {
                const refund = await this.refundRepository.findByIdForUpdate(refundRecordId, trx);
                if (refund) {
                    refund.status = "FAILED";
                    refund.failureReason = errorReason;
                    await this.refundRepository.update(refund, trx);
                }
            });
        } catch (logError) {
            this.logger.error("Failed writing background state failure records", logError);
        }
    }

    #authorize(payment, user) {
        // Validation logic
    }
}