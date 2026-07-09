/**
 * Custom Operational Gateway Exception to map errors without stripping network metadata.
 */
class GatewayTransmissionError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = "GatewayTransmissionError";
        this.statusCode = originalError?.statusCode || originalError?.response?.status || originalError?.status;
        this.code = originalError?.code; // Maps to provider code frameworks (e.g., Twilio 21211 errors)
        this.retryable = originalError?.retryable;
    }
}

/**
 * Infrastructure Layer Transport Adapter.
 * Encapsulates the network boundary for SMS delivery (e.g., Twilio, Vonage, or AWS SNS).
 */
export class SmsGateway {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.smsProviderClient - Raw SDK instance (e.g., twilio client, @vonage/server-sdk)
     * @param {string} dependencies.fromNumberOrSenderId - Your verified alphanumeric Sender ID or virtual phone number (e.g., +1234567890 or "CONF_ALERT")
     * @param {Object} [dependencies.logger] - Structured diagnostic logging mechanism
     */
    constructor({ smsProviderClient, fromNumberOrSenderId, logger = console }) {
        if (!smsProviderClient) throw new Error("Gateway Initialization Error: Third-party smsProviderClient instance is mandatory.");
        if (!fromNumberOrSenderId) throw new Error("Gateway Initialization Error: A verified 'fromNumberOrSenderId' string is required.");

        this.smsProviderClient = smsProviderClient;
        this.fromNumberOrSenderId = fromNumberOrSenderId;
        this.logger = logger;
    }

    /**
     * Translates clean domain attributes into cellular SMS transmission payloads.
     * 
     * @param {Object} request
     * @param {string} request.to - Target mobile recipient phone number (strictly matching E.164 string format)
     * @param {string} request.message - Plain text message content context body string
     * @param {Object} [request.metadata] - Optional operational payload tracking properties
     * @returns {Promise<void>}
     */
    async send({ to, message, metadata = {} }) {
        // 1. Defensively sanitize and validate incoming structural mobile payload boundaries
        if (!to || typeof to !== "string") {
            throw new Error("Gateway Pre-flight Rejection: Target phone number parameter must be a valid string.");
        }

        // Clean typical visual formatting artifacts out of the number stream
        const cleanedNumber = to.replace(/[\s\-()]/g, "");

        // E.164 validation regex: must start with '+' followed by 7 to 15 digits.
        const e164Regex = /^\+[1-9]\d{6,14}$/;
        if (!e164Regex.test(cleanedNumber)) {
            throw new Error(`Gateway Pre-flight Rejection: Target phone number '${to}' must strictly conform to standard international E.164 formatting conventions.`);
        }
        
        if (!message || message.trim().length === 0) {
            throw new Error("Gateway Pre-flight Rejection: Cannot dispatch an empty SMS body context layer.");
        }

        const idempotencyKey = metadata?.idempotencyKey || null;

        try {
            this.logger.debug(`SMS Gateway: Attempting cellular dispatch to ${cleanedNumber} [Idempotency: ${idempotencyKey || "none"}]`);

            // 2. Route execution matching your downstream vendor SDK interface signature
            if (this.smsProviderClient.messages && typeof this.smsProviderClient.messages.create === "function") {
                // Typical Twilio Node-SDK structural layout format pattern
                await this.smsProviderClient.messages.create({
                    to: cleanedNumber,
                    from: this.fromNumberOrSenderId,
                    body: message.trim(),
                    // Pass tracking correlation IDs natively into upstream webhook logs if supported
                    clientReference: metadata?.correlationId || metadata?.conferenceId
                });
            } else if (this.smsProviderClient.sms && typeof this.smsProviderClient.sms.send === "function") {
                // Typical Vonage/Nexmo structural interface fallback layout pattern
                await new Promise((resolve, reject) => {
                    this.smsProviderClient.sms.send({
                        to: cleanedNumber,
                        from: this.fromNumberOrSenderId,
                        text: message.trim()
                    }, (err, responseData) => {
                        if (err) return reject(err);
                        
                        // Vonage passes 200 HTTP statuses even on delivery failure messages inside the response body array
                        const status = responseData.messages?.[0]?.status;
                        if (status !== "0") {
                            const vonageError = new Error(`Vonage Dispatch Error Code: ${status} - ${responseData.messages?.[0]?.['error-text']}`);
                            vonageError.code = status;
                            vonageError.statusCode = 400; // Map down as a client bad request error
                            return reject(vonageError);
                        }
                        resolve();
                    });
                });
            } else {
                throw new Error("Target SMS client provider lacks a recognizable message delivery implementation driver contract.");
            }

            this.logger.info(`SMS Gateway Success: Packet pushed out cleanly targeting ${cleanedNumber}`);

        } catch (providerError) {
            const diagnosticMessage = providerError.message || String(providerError);

            this.logger.error(`SMS Gateway Transmission Failure targeting ${cleanedNumber}: ${diagnosticMessage}`, {
                error: providerError,
                idempotencyKey
            });

            // 3. Assess for permanent cellular rejections (e.g., text to landline or invalid numbers)
            // Twilio Code 21211 is "Invalid 'To' Phone Number", Code 21614 is "Not a valid mobile number/cannot receive SMS", Code 21408 is "Cannot route to landline"
            // Vonage Code 3 is "Invalid Value", Code 6 is "Illegal Sender Address - rejected by carrier"
            const errorCode = Number(providerError.code);
            const permanentFailureCodes = [21211, 21614, 21408, 3, 6];

            if (permanentFailureCodes.includes(errorCode)) {
                providerError.retryable = false;
            }

            throw new GatewayTransmissionError(
                `Provider SMS Cellular Rejection: ${diagnosticMessage}`,
                providerError
            );
        }
    }
}