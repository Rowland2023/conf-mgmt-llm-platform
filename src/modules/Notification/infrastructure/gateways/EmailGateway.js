/**
 * Infrastructure Layer Transport Adapter.
 * Encapsulates the network boundary for Email delivery, handles third-party
 * API handshake protocols, and maps provider-specific errors cleanly.
 */
export class EmailGateway {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.mailProviderClient - Raw SDK instance (e.g., @sendgrid/mail, AWS.SESv2, or nodemailer transport)
     * @param {string} dependencies.fromAddress - Verified organization sender address (e.g., no-reply@conference.com)
     * @param {Object} [dependencies.logger] - Structured diagnostic logging mechanism
     */
    constructor({ mailProviderClient, fromAddress, logger = console }) {
        if (!mailProviderClient) throw new Error("Gateway Initialization Error: Third-party mailProviderClient instance is mandatory.");
        if (!fromAddress) throw new Error("Gateway Initialization Error: A verified organization 'fromAddress' must be configured.");
        
        this.mailProviderClient = mailProviderClient;
        this.fromAddress = fromAddress;
        this.logger = logger;
    }

    /**
     * Translates clean domain payloads into strict multi-part network transmission formats.
     * Injecting native provider headers enforces upstream idempotency protection layers.
     * 
     * @param {Object} request
     * @param {string} request.to - Target recipient email address string
     * @param {string} request.subject - Email theme descriptor title header
     * @param {string} request.body - Content message body payload 
     * @param {Object} [request.metadata] - Optional tracing structural keys containing the idempotency token
     * @returns {Promise<void>}
     */
    async send({ to, subject, body, metadata = {} }) {
        // 1. Defensively validate incoming structural payload boundaries
        if (!to || !to.includes("@")) {
            throw new Error(`Gateway Pre-flight Rejection: Invalid or missing recipient email layout descriptor: '${to}'`);
        }
        if (!subject || !body) {
            throw new Error("Gateway Pre-flight Rejection: Cannot dispatch an email missing a subject header or content body.");
        }

        // 2. Extract the dispatcher-generated token to wire up transactional safety mechanics
        const idempotencyKey = metadata?.idempotencyKey || null;

        // 3. Assemble the raw third-party transport mapping envelope
        const payloadEnvelope = {
            to,
            from: this.fromAddress,
            subject: subject.trim(),
            text: body, // Fallback multi-part plaintext representation
            html: body, // Assumes text strings may contain styled markup extensions
            headers: {
                // Standard SMTP tracking trace header
                "X-Correlation-ID": metadata?.correlationId || metadata?.conferenceId || "system-dispatch",
                ...(idempotencyKey && {
                    // Injecting native provider deduplication headers (e.g., SendGrid/Stripe style)
                    "Idempotency-Key": idempotencyKey,
                    "X-Idempotency-Key": idempotencyKey
                })
            }
        };

        try {
            this.logger.debug(`Email Gateway: Attempting transport dispatch to ${to} [Idempotency: ${idempotencyKey || "none"}]`);
            
            // 4. Fire the network transmission against your chosen client driver interface
            // (Adjust slightly depending on your vendor: e.g., .send() for SendGrid, .sendMail() for Nodemailer)
            if (typeof this.mailProviderClient.send === "function") {
                await this.mailProviderClient.send(payloadEnvelope);
            } else if (typeof this.mailProviderClient.sendMail === "function") {
                await this.mailProviderClient.sendMail(payloadEnvelope);
            } else {
                throw new Error("Target mail client driver lacks a recognizable execution interface handler (.send / .sendMail).");
            }

        } catch (providerError) {
            // 5. Unpack specific third-party failure descriptors to isolate the aggregate domain boundary
            const diagnosticMessage = providerError.response?.body?.errors?.[0]?.message 
                || providerError.message 
                || String(providerError);

            this.logger.error(`Email Gateway Transmission Failure targeting ${to}: ${diagnosticMessage}`, { 
                error: providerError,
                idempotencyKey 
            });

            // Re-throw safely formatted so your NotificationDispatcher catches it and maps it to 'markAsFailed()'
            throw new Error(`Provider Mail Network Rejection: ${diagnosticMessage}`);
        }
    }
}