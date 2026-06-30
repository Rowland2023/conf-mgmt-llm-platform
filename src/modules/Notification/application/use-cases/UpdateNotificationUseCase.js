export class UpdateNotificationUseCase {
  constructor({ notificationRepository }) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Orchestrates the business rules for updating an existing notification record.
   */
  async execute({ id, tenantId, requestedBy, ...updateData }) {
    // 1. Validate mandatory identifier
    if (!id) {
      throw new Error("Missing mandatory field: 'id' is required to update a notification.");
    }

    // 2. Fetch the notification to verify its existence
    const existingNotification = await this.notificationRepository.findById(id);
    
    if (!existingNotification) {
      throw new Error("Notification not found.");
    }

    // 3. Enforce Multi-Tenancy Boundary Isolation
    // Ensures that one conference organization/tenant cannot modify or view data belonging to another.
    if (tenantId && existingNotification.tenantId !== tenantId) {
      throw new Error("Unauthorized: You do not have permission to modify this resource.");
    }

    try {
      // 4. Sanitize or shape the payload data to match your allowed update fields
      // Typically, external clients can only update flags like 'status' (e.g., 'READ', 'ARCHIVED')
      const fieldsToUpdate = {
        ...updateData,
        updatedBy: requestedBy,
        updatedAt: new Date()
      };

      // 5. Commit the modifications down to your abstract database repository layer
      const updatedNotification = await this.notificationRepository.update(id, fieldsToUpdate);

      return updatedNotification;

    } catch (error) {
      throw new Error(`Failed to update notification: ${error.message}`);
    }
  }
}