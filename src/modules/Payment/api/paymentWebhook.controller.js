export class PaymentWebhookController {
    constructor({ handleWebhookUseCase }) {
        this.handleWebhookUseCase = handleWebhookUseCase;
    }

    async handle(req, res, next) {
        try {
            await this.handleWebhookUseCase.execute({
                rawBody: req.rawBody,
                headers: req.headers
            });

            return res.sendStatus(200);
        } catch (error) {
            next(error);
        }
    }
}