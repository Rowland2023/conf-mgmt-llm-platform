export class SendEmailUseCase {
  constructor({ notificationRepository, emailGateway, idempotencyService }) {
    this.notificationRepository = notificationRepository;
    this.emailGateway = emailGateway;
    this.idempotencyService = idempotencyService;
  }

  async execute({ to, templateKey, templateData, requestedBy, tenantId, idempotencyKey }) {
    // 1. Enforce Idempotency Guardrails
    if (idempotencyKey) {
      const existingRequest = await this.idempotencyService.get(idempotencyKey);
      if (existingRequest) {
        // Return cached response if it's already processed or in-flight
        return existingRequest; 
      }
    }

    // 2. Simple Input Validation
    if (!to || !templateKey) {
      throw new Error("Missing mandatory fields: 'to' and 'templateKey' are required.");
    }

    // 3. Create an initial "PENDING" notification record in your database log
    const notificationLog = await this.notificationRepository.create({
      tenantId,         // Links to the specific conference/organization
      recipient: to,
      channel: 'EMAIL',
      templateKey,
      status: 'PENDING',
      requestedBy
    });

    try {
      // 4. Delegate compilation and delivery to your infrastructure layer (Email Gateway)
      // The gateway maps 'templateKey' to your HTML templates (e.g., 'ticket_purchase', 'session_cancelled')
      const deliveryResult = await this.emailGateway.send({
        to,
        templateKey,
        templateData // Object containing dynamic values like { attendeeName: 'John', price: '$50' }
      });

      // 5. Update log status to 'SENT' upon successful delivery
      const updatedLog = await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'SENT',
        externalMessageId: deliveryResult.messageId,
        sentAt: new Date()
      });

      const responsePayload = {
        success: true,
        notificationId: updatedLog.id,
        status: updatedLog.status
      };

      // Save to idempotency store before returning
      if (idempotencyKey) {
        await this.idempotencyService.set(idempotencyKey, responsePayload);
      }

      return responsePayload;

    } catch (error) {
      // 6. Fail Gracefully: Mark log as 'FAILED' so conference admins can track failed alerts
      await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'FAILED',
        errorDetails: error.message
      });

      throw error;
    }
  }
}