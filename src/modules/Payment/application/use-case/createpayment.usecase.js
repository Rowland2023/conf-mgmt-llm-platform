import { ValidationError, GatewayError } from "../../domain/errors/PaymentErrors.js";
import { Payment } from "../../domain/entities/Payment.js";
import { CreatePaymentCommand } from "../../domain/commands/CreatePaymentCommand.js";

export class CreatePaymentUseCase {
    constructor(deps) {
        Object.assign(this, deps);
    }

    async execute(input) {
        const startedAt = Date.now();
        const command = new CreatePaymentCommand(input);

        let payment = await this._loadOrCreate(command);
        
        if (payment.status === "CREATED") {
            payment = await this._initializeGateway(payment);
        }

        this.metrics?.increment?.("payment.created");
        this.metrics?.histogram?.("payment.creation.duration", Date.now() - startedAt);
        
        return payment.toResponse();
    }

    async _loadOrCreate(command) {
        try {
            return await this.unitOfWork.execute(async (trx) => {
                const existing = await this.paymentRepository.findByIdempotencyKey(command.tenantId, command.idempotencyKey, trx);
                if (existing) return existing;

                const payment = Payment.create({
                    id: this.idGenerator.generate(),
                    ...command,
                    status: "CREATED",
                    createdAt: this.clock.now()
                });

                await this.paymentRepository.save(payment, trx);
                await this._flushEvents(payment, trx);
                return payment;
            });
        } catch (error) {
            if (this._isUniqueViolation(error)) {
                this.metrics?.increment?.("payment.idempotency.hit");
                const concurrentRecord = await this.paymentRepository.findByIdempotencyKey(command.tenantId, command.idempotencyKey);
                
                if (!concurrentRecord) {
                    throw new ValidationError("A concurrent payment request is currently processing. Please retry.");
                }
                return concurrentRecord;
            }
            throw error;
        }
    }

    async _initializeGateway(payment) {
        const gateway = this.paymentGatewayFactory.create(payment.gateway);
        let session;

        // 1. Fire external network call safely OUTSIDE of database transactions
        try {
            session = await gateway.initializeTransaction({
                reference: payment.id,
                amount: payment.amount,
                currency: payment.currency,
                email: payment.email,
                metadata: payment.gatewayMetadata()
            });
        } catch (error) {
            // 2. Safely capture failure using a short, fast row-lock transaction block
            return await this.unitOfWork.execute(async (trx) => {
                const fresh = await this.paymentRepository.findByIdForUpdate(payment.id, trx);
                if (fresh.status !== "CREATED") return fresh;

                fresh.markInitializationFailed({
                    message: error.message,
                    code: error.code,
                    provider: fresh.gateway
                });
                await this.paymentRepository.update(fresh, trx);
                await this._flushEvents(fresh, trx);
                return fresh;
            });
        }

        // 3. Update success using a short, fast row-lock transaction block
        return await this.unitOfWork.execute(async (trx) => {
            const fresh = await this.paymentRepository.findByIdForUpdate(payment.id, trx);
            if (fresh.status !== "CREATED") return fresh; // Idempotent protection

            fresh.markGatewayInitialized({
                externalReference: session.reference,
                checkoutUrl: session.checkoutUrl
            });

            await this.paymentRepository.update(fresh, trx);
            await this._flushEvents(fresh, trx);
            return fresh;
        });
    }

    async _flushEvents(aggregate, trx) {
        for (const event of aggregate.pullDomainEvents()) {
            await this.outboxRepository.save(event, trx);
        }
    }

    _isUniqueViolation(error) {
        return error.code === "23505" || /unique|duplicate/i.test(error.message);
    }
}