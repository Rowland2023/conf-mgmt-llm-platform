// src/modules/Payment/api/payment.webhook.js

export class PaymentWebhookController {
    constructor({ handleWebhookUseCase }) {
        this.handleWebhookUseCase = handleWebhookUseCase;
    }

    async handlePaystackWebhook(req, res, next) {
        try {
            await this.handleWebhookUseCase.execute({
                gateway: 'paystack',
                rawBody: req.rawBody,
                headers: req.headers
            });
            return res.sendStatus(200);
        } catch (error) {
            next(error);
        }
    }

    async handleStripeWebhook(req, res, next) {
        try {
            await this.handleWebhookUseCase.execute({
                gateway: 'stripe',
                rawBody: req.rawBody,
                headers: req.headers
            });
            return res.sendStatus(200);
        } catch (error) {
            next(error);
        }
    }
}