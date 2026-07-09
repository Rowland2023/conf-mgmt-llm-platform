/**
 * Application Layer Use Case.
 * Coordinates strict transaction boundaries, acquires row-level pessimistic locks,
 * and delegates safe execution context to the infrastructure layer dispatcher.
 */
export class SendNotificationUseCase {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.dbClient - Database transaction pool manager
     * @param {PostgresNotificationRepository} dependencies.notificationRepository - Your locked Postgres repo boundary
     * @param {NotificationDispatcher} dependencies.notificationDispatcher - Resilient delivery orchestrator
     */
    constructor({ dbClient, notificationRepository, notificationDispatcher }) {
        this.dbClient = dbClient;
        this.notificationRepository = notificationRepository;
        this.notificationDispatcher = notificationDispatcher;
    }

    /**
     * Pulls, locks, and dispatches a notification aggregate within an atomic unit of work.
     * 
     * @param {Object} request
     * @param {string} request.notificationId - The target entity UUID to read-lock and transmit
     * @returns {Promise<void>}
     */
    async execute({ notificationId }) {
        if (!notificationId) {
            throw new Error("Application Error: 'notificationId' is strictly required for dispatch execution.");
        }

        // Establish an isolated database transaction boundary
        await this.dbClient.transaction(async (trx) => {
            
            // 1. Acquire row-level lock (FOR UPDATE) to block concurrent worker interference
            const notification = await this.notificationRepository.findByIdForUpdate(notificationId, trx);
            
            if (!notification) {
                throw new Error(`Application Error: Notification aggregate with ID '${notificationId}' could not be located.`);
            }

            // 2. Delegate downstream transmission routing, status mutations, and event generation.
            // The dispatcher will save the mutated state back using the same 'trx' context.
            await this.notificationDispatcher.dispatch(notification, trx);
        });
    }
}