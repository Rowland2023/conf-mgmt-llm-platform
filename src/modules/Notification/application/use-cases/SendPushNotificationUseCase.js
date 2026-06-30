export class SendPushNotificationUseCase {
  constructor({ notificationRepository, pushNotificationGateway, idempotencyService }) {
    this.notificationRepository = notificationRepository;
    this.pushNotificationGateway = pushNotificationGateway;
    this.idempotencyService = idempotencyService;
  }

  /**
   * Orchestrates the business rules for dispatching a push notification to mobile devices.
   */
  async execute({ recipientId, title, body, payload = {}, requestedBy, tenantId, idempotencyKey }) {
    // 1. Enforce Idempotency Guardrails
    if (idempotencyKey) {
      const existingRequest = await this.idempotencyService.get(idempotencyKey);
      if (existingRequest) {
        // Return the cached response to prevent duplicate alert spam on the device
        return existingRequest; 
      }
    }

    // 2. Validate mandatory parameters
    if (!recipientId || !title || !body) {
      throw new Error("Missing mandatory fields: 'recipientId', 'title', and 'body' are required.");
    }

    // 3. Log the notification in the local repository with a 'PENDING' status
    const notificationLog = await this.notificationRepository.create({
      tenantId,         // Links the notification to a specific conference or organizer setup
      userId: recipientId,
      channel: 'PUSH',
      title,
      body,
      payload,          // Extra router variables like { targetScreen: 'SessionDetails', trackId: '123' }
      status: 'PENDING',
      requestedBy
    });

    try {
      // 4. Delegate deep device delivery to the infrastructure tier gateway
      // The gateway will map the recipientId to their respective mobile FCM/APNs registration device tokens
      const deliveryResult = await this.pushNotificationGateway.send({
        recipientId,
        title,
        body,
        payload
      });

      // 5. Update database log status to 'SENT' upon provider acceptance
      const updatedLog = await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'SENT',
        externalMessageId: deliveryResult.messageId, // ID returned from Firebase/OneSignal
        sentAt: new Date()
      });

      const responsePayload = {
        success: true,
        notificationId: updatedLog.id,
        status: updatedLog.status
      };

      // 6. Cache successful receipt into your idempotency service
      if (idempotencyKey) {
        await this.idempotencyService.set(idempotencyKey, responsePayload);
      }

      return responsePayload;

    } catch (error) {
      // 7. Graceful Failure: Mark log as 'FAILED' for developer debugging or organizer audit reports
      await this.notificationRepository.updateStatus(notificationLog.id, {
        status: 'FAILED',
        errorDetails: error.message
      });

      throw error;
    }
  }
}