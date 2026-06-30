export class ListNotificationsUseCase {
  constructor({ notificationRepository }) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Orchestrates the business rules for fetching and filtering a list of notifications.
   */
  async execute({ tenantId, userId, page = 1, limit = 10, ...filters }) {
    // 1. Sanitize pagination values to avoid database extraction errors
    const sanitizedPage = Math.max(1, parseInt(page, 10));
    const sanitizedLimit = Math.max(1, Math.min(100, parseInt(limit, 10))); // Cap maximum limit per request at 100
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    // 2. Build the query criteria matching structural boundaries
    // Enforces multi-tenancy data boundaries and restricts users to seeing only their own feed
    const queryCriteria = {
      ...filters,
      ...(tenantId && { tenantId }),
      ...(userId && { userId }) // Filters logs destined for this attendee, speaker, or coordinator
    };

    try {
      // 3. Query data repository for records and total count simultaneously to optimize network I/O
      const [notifications, totalCount] = await Promise.all([
        this.notificationRepository.findMany(queryCriteria, { 
          limit: sanitizedLimit, 
          offset 
        }),
        this.notificationRepository.count(queryCriteria)
      ]);

      // 4. Return standard structured pagination response payload
      return {
        data: notifications,
        pagination: {
          total: totalCount,
          page: sanitizedPage,
          limit: sanitizedLimit,
          totalPages: Math.ceil(totalCount / sanitizedLimit)
        }
      };

    } catch (error) {
      throw new Error(`Failed to list notifications: ${error.message}`);
    }
  }
}