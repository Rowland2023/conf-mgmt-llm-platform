// infrastructure/telemetry/TelemetryUseCaseDecorator.js
export class TelemetryUseCaseDecorator {
    /**
     * @param {Object} useCase - The actual business use case instance
     * @param {import('../../ports/ILogger.js').ILogger} logger
     * @param {import('../../ports/IMetrics.js').IMetrics} metrics
     * @param {string} useCaseName - E.g., 'Payment.Create'
     */
    constructor(useCase, logger, metrics, useCaseName) {
        this.useCase = useCase;
        this.logger = logger.child({ useCase: useCaseName });
        this.metrics = metrics;
        this.useCaseName = useCaseName.toLowerCase();
    }

    async execute(input, context = {}) {
        const startedAt = Date.now();
        
        // Inject Tracing context down into the logger
        const opLogger = this.logger.child({
            correlationId: input.correlationId || context.correlationId,
            tenantId: input.tenantId
        });

        opLogger.info(`Starting execution context for ${this.useCaseName}`);

        try {
            // Forward execution down to the pure business logic use case
            const result = await this.useCase.execute(input);

            // Emit Metrics automatically on success
            const duration = Date.now() - startedAt;
            this.metrics.increment(`${this.useCaseName}.success`);
            this.metrics.histogram(`${this.useCaseName}.duration`, duration);

            opLogger.info(`Completed execution framework successfully`, { durationMs: duration });
            return result;

        } catch (error) {
            const duration = Date.now() - startedAt;
            this.metrics.increment(`${this.useCaseName}.failure`);
            
            opLogger.error(`Execution halted due to uncaught failure`, {
                errorMessage: error.message,
                stack: error.stack,
                durationMs: duration
            });
            
            throw error;
        }
    }
}