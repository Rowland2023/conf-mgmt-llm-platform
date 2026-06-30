export class DeleteNotificationUseCase {
  constructor({ notificationRepository }) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Orchestrates the business rules for deleting a notification log or hiding it from a feed.
   */
  async execute({ id, requestedBy, tenantId }) {
    // 1. Validate mandatory input identifiers
    if (!id) {
      throw new Error("Missing mandatory field: 'id' is required to delete a notification.");
    }

    // 2. Fetch the existing notification to verify its existence and ownership
    const existingNotification = await this.notificationRepository.findById(id);
    
    if (!existingNotification) {
      throw new Error("Notification not found.");
    }

    // 3. Enforce Multi-Tenancy Protection
    // Ensures cross-tenant security boundaries inside your multi-conference application
    if (tenantId && existingNotification.tenantId !== tenantId) {
      throw new Error("Unauthorized: You do not have permission to delete this resource.");
    }

    try {
      // 4. Perform the deletion block
      // Note: In enterprise applications, a Soft Delete (e.g., setting deletedAt or isDeleted) 
      // is highly recommended over a Hard Delete to preserve historical logs for system audits.
      await this.notificationRepository.delete(id, {
        deletedBy: requestedBy,
        deletedAt: new Date()
      });

      return {
        success: true,
        message: "Notification successfully deleted."
      };

    } catch (error) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  }
}