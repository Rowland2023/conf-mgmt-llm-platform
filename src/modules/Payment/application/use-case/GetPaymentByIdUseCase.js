import {
    ValidationError,
    NotFoundError
} from "../../domain/errors/PaymentErrors.js";

import { GetPaymentByIdQuery } from "../../domain/queries/GetPaymentByIdQuery.js";

export class GetPaymentByIdUseCase {
    constructor({
        paymentRepository,
        logger = console,
        metrics
    }) {
        if (!paymentRepository) {
            throw new Error(
                "GetPaymentByIdUseCase requires paymentRepository."
            );
        }

        this.paymentRepository = paymentRepository;
        this.logger = logger;
        this.metrics = metrics;
    }

    async execute(input) {
        const startedAt = Date.now();

        const query = new GetPaymentByIdQuery(input);

        const payment = await this.#loadPayment(query.id);

        this.#authorize(payment, query.currentUser);

        this.logger.info?.(
            {
                paymentId: payment.id,
                tenantId: payment.tenantId,
                requestedBy: query.currentUser.id
            },
            "Payment retrieved."
        );

        this.metrics?.increment?.("payment.get.request");
        this.metrics?.histogram?.(
            "payment.get.duration",
            Date.now() - startedAt
        );

        return payment.toResponse();
    }

    async #loadPayment(paymentId) {
        const payment =
            await this.paymentRepository.findById(paymentId);

        if (!payment) {
            // Prevent resource enumeration
            throw new NotFoundError(
                "Payment not found."
            );
        }

        return payment;
    }

    #authorize(payment, currentUser) {
        if (!currentUser) {
            throw new ValidationError(
                "Authenticated user context is required."
            );
        }

        // Platform administrator
        if (currentUser.role === "admin") {
            return;
        }

        // Tenant isolation
        if (
            currentUser.tenantId &&
            payment.tenantId === currentUser.tenantId
        ) {
            return;
        }

        // Individual ownership
        if (
            payment.userId &&
            payment.userId === currentUser.id
        ) {
            return;
        }

        if (
            payment.email &&
            currentUser.email &&
            payment.email === currentUser.email
        ) {
            return;
        }

        // Hide existence of resources belonging to another tenant
        throw new NotFoundError(
            "Payment not found."
        );
    }
}