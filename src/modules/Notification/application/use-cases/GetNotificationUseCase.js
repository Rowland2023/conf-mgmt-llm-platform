export class GetNotificationUseCase {
  constructor({ notificationRepository }) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Orchestrates the business rules for fetching a single notification record.
   */
  async execute({ id, tenantId }) {
    // 1. Validate mandatory input
    if (!id) {
      throw new Error("Missing mandatory field: 'id' is required to retrieve a notification.");
    }

    // 2. Fetch the notification from the data repository
    const notification = await this.notificationRepository.findById(id);

    // 3. Fail gracefully if the record does not exist
    if (!notification) {
      throw new Error("Notification not found.");
    }

    // 4. Enforce Multi-Tenancy Boundary Isolation
    // Ensures cross-tenant security inside a multi-conference application environment
    if (tenantId && notification.tenantId !== tenantId) {
      throw new Error("Unauthorized: You do not have permission to view this resource.");
    }

    // 5. Return the notification domain object/data
    return notification;
  }
}