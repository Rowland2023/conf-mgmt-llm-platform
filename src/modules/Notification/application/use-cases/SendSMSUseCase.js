export class SendSMSUseCase {
  constructor({ notificationRepository, smsGateway, idempotencyService }) {
    this.notificationRepository = notificationRepository;
    this.smsGateway = smsGateway;
    this.idempotencyService = idempotencyService;
  }

  /**
   * Orchestrates the business rules for sending an SMS notification
   */
  async execute({ phoneNumber, message, requestedBy, tenantId, idempotencyKey }) {
    // 1. Enforce Idempotency Guardrails
    if (idempotencyKey) {
      const existingRequest = await this.idempotencyService.get(idempotencyKey);
      if (existingRequest) {
        // Return the cached result to prevent double sending charges
        return existingRequest; 
      }
    }

    // 2. Validate mandatory parameters
    if (!phoneNumber || !message) {
      throw new Error("Missing mandatory fields: 'phoneNumber' and 'message' are required.");
    }

    // 3. Create an initial tracking record in your database log with a 'PENDING' status
    const notificationLog = await this.notificationRepository.create({
      tenantId,         // Groups notifications under a specific conference organization
      recipient: phoneNumber,
      channel: 'SMS',
      body: message,
      status: 'PENDING',
      requestedBy
    });

    try {
      // 4. Delegate network delivery to your infrastructure tier gateway
      const deliveryResult = await this.smsGateway.send({
        to: phoneNumber,
        text: message
      });

      // 5. Update database status to 'SENT' upon provider acknowledgment
      const updatedLog = await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'SENT',
        externalMessageId: deliveryResult.messageId, // The ID returned from Twilio/Termii/Infobip
        sentAt: new Date()
      });

      const responsePayload = {
        success: true,
        notificationId: updatedLog.id,
        status: updatedLog.status
      };

      // 6. Save the successful execution receipt inside your idempotency cache
      if (idempotencyKey) {
        await this.idempotencyService.set(idempotencyKey, responsePayload);
      }

      return responsePayload;

    } catch (error) {
      // 7. Graceful Failure: Update log to 'FAILED' so admins can audit undelivered alerts
      await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'FAILED',
        errorDetails: error.message
      });

      throw error;
    }
  }
}