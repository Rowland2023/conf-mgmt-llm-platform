/**
 * Custom Operational Gateway Exception to map errors without stripping network metadata.
 */
class GatewayTransmissionError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = "GatewayTransmissionError";
        this.statusCode = originalError?.statusCode || originalError?.response?.status || originalError?.status;
        this.code = originalError?.code || originalError?.errorInfo?.code; // .errorInfo handles Firebase/FCM error patterns
        this.retryable = originalError?.retryable;
    }
}

/**
 * Infrastructure Layer Transport Adapter.
 * Encapsulates the network boundary for Push Notification delivery (e.g., Firebase FCM Client).
 * Converts clean domain entities into structured cloud messaging packets.
 */
export class PushNotificationGateway {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.pushProviderClient - Raw SDK instance (e.g., firebase-admin messaging instance or web-push)
     * @param {Object} [dependencies.logger] - Structured diagnostic logging mechanism
     */
    constructor({ pushProviderClient, logger = console }) {
        if (!pushProviderClient) throw new Error("Gateway Initialization Error: Third-party pushProviderClient instance is mandatory.");
        
        this.pushProviderClient = pushProviderClient;
        this.logger = logger;
    }

    /**
     * Translates domain parameters into structured JSON network payloads for push servers.
     * 
     * @param {Object} request
     * @param {string} request.token - The downstream mobile/web device target registration token
     * @param {string} request.title - Header bold caption title for the system tray display
     * @param {string} request.body - Content message body payload
     * @param {Object} [request.metadata] - Optional operational payload keys containing tracking tokens
     * @returns {Promise<void>}
     */
    async send({ token, title, body, metadata = {} }) {
        // 1. Defensively validate incoming structural payload boundaries
        if (!token || typeof token !== "string" || token.trim().length === 0) {
            throw new Error("Gateway Pre-flight Rejection: Target registration device token is missing or malformed.");
        }
        if (!body) {
            throw new Error("Gateway Pre-flight Rejection: Cannot dispatch an empty push payload packet.");
        }

        const idempotencyKey = metadata?.idempotencyKey || null;
        const correlationId = metadata?.correlationId || metadata?.conferenceId || "system-dispatch";

        // 2. Assemble standard structured messaging payload container (FCM v1 API compatible layout template)
        const payloadEnvelope = {
            token: token.trim(),
            notification: {
                title: title ? title.trim() : undefined,
                body: body.trim()
            },
            // Metadata mapping pass-through. Stringifying fields explicitly prevents raw FCM validation crashes.
            data: {
                correlationId: String(correlationId),
                ...(idempotencyKey && { idempotencyKey: String(idempotencyKey) })
            },
            // Android platform specific settings overrides
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    clickAction: "OPEN_ACTIVITY_NOTIFICATION"
                }
            },
            // iOS/Apple platform specific overrides
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1
                    }
                }
            }
        };

        try {
            this.logger.debug(`Push Gateway: Attempting network delivery to token hash [${token.slice(0, 10)}...]`);

            // 3. Dispatch the payload based on common vendor SDK naming patterns (.send / .sendToDevice)
            if (typeof this.pushProviderClient.send === "function") {
                await this.pushProviderClient.send(payloadEnvelope);
            } else if (typeof this.pushProviderClient.sendToDevice === "function") {
                // Compatibility layer fallback for legacy patterns
                await this.pushProviderClient.sendToDevice(token, {
                    notification: payloadEnvelope.notification,
                    data: payloadEnvelope.data
                });
            } else {
                throw new Error("Target push provider client lacks a recognizable delivery interface handler (.send).");
            }

        } catch (providerError) {
            // 4. Unpack specific third-party error wrappers (e.g., Firebase error structures)
            const diagnosticMessage = providerError.errorInfo?.message 
                || providerError.message 
                || String(providerError);

            this.logger.error(`Push Gateway Transmission Failure targeting token [${token.slice(0, 10)}...]: ${diagnosticMessage}`, {
                error: providerError,
                idempotencyKey
            });

            // 5. Inspect for specific terminal push errors (e.g., Unregistered device token)
            // If the token is invalid, we explicitly don't want the dispatcher to flag it as a retryable error.
            const errorCode = providerError.errorInfo?.code || "";
            if (
                errorCode === "messaging/registration-token-not-registered" || 
                errorCode === "messaging/invalid-argument" ||
                diagnosticMessage.toLowerCase().includes("baddevicetoken") ||
                diagnosticMessage.toLowerCase().includes("unregistered")
            ) {
                // Ensure the dispatcher maps this to a permanent failure instead of clogging your background queue
                providerError.retryable = false;
            }

            throw new GatewayTransmissionError(
                `Provider Push Network Rejection: ${diagnosticMessage}`,
                providerError
            );
        }
    }
}