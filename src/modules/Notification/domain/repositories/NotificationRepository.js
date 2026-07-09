/**
 * Notification Repository Contract interface.
 *
 * Defines the strict persistence operations required by the Notification
 * domain and application core layers.
 * 
 * Infrastructure adapters (e.g., Knex/Postgres or Prisma repositories)
 * must implement this contract explicitly.
 */
export class NotificationRepository {
    /**
     * Persist a Notification aggregate state shell.
     *
     * @param {Object} notification - The Notification aggregate instance
     * @param {Object|null} [trx=null] - Optional transaction client context instance
     * @returns {Promise<void>}
     */
    async save(notification, trx = null) {
        throw new Error("NotificationRepository.save() must be implemented.");
    }

    /**
     * Find a notification aggregate by its unique identifier.
     *
     * @param {string} id - The Notification identifier UUID
     * @returns {Promise<Object|null>} The reconstituted aggregate instance, or null if not found
     */
    async findById(id) {
        throw new Error("NotificationRepository.findById() must be implemented.");
    }

    /**
     * Load a notification aggregate using an exclusive row-level write lock (e.g., SELECT FOR UPDATE).
     * Guarded to guarantee an active transaction exists to maintain the row lock lifespan.
     *
     * @param {string} id - The Notification identifier UUID
     * @param {Object} trx - Active transaction client adapter instance
     * @returns {Promise<Object|null>} The reconstituted locked aggregate instance, or null if not found
     */
    async findByIdForUpdate(id, trx) {
        if (!trx) throw new Error("NotificationRepository.findByIdForUpdate requires an active transaction.");
        throw new Error("NotificationRepository.findByIdForUpdate() must be implemented.");
    }

    /**
     * Retrieve a batch of scheduled reminders that are due for delivery.
     * Used by background workers or cron dispatch engines.
     *
     * @param {Date} before - Cutoff boundary timestamp (typically current execution runtime)
     * @param {number} [limit=100] - Hard upper limit capping batch size to preserve buffer safety
     * @returns {Promise<Object[]>} Array of reconstituted due Notification aggregate instances
     */
    async findScheduledDue(before, limit = 100) {
        throw new Error("NotificationRepository.findScheduledDue() must be implemented.");
    }

    /**
     * Query notification history records targeting a specific user entity.
     * Uses forward cursor-based pagination parameters to support infinitely scrolling history lists.
     *
     * @param {string} userId - Target recipient identifier
     * @param {Object} [options]
     * @param {number} [options.limit=20] - Number of records to pull in this page slice
     * @param {string|null} [options.cursor=null] - Unique cursor hash point indicating page boundaries (usually an encoded record ID/timestamp combination)
     * @returns {Promise<Object[]>} Array of paginated Notification aggregate instances
     */
    async findByUserId(userId, { limit = 20, cursor = null } = {}) {
        throw new Error("NotificationRepository.findByUserId() must be implemented.");
    }

    /**
     * Remove a notification aggregate completely from persistent storage.
     *
     * @param {string} id - The Notification identifier UUID
     * @param {Object|null} [trx=null] - Optional transaction client context instance
     * @returns {Promise<void>}
     */
    async delete(id, trx = null) {
        throw new Error("NotificationRepository.delete() must be implemented.");
    }

    /**
     * Execute a collection of database operations sequentially inside an isolated database transaction block.
     *
     * @param {function(Object): Promise<any>} callback - Executable unit of work receiving the raw transaction driver context
     * @returns {Promise<any>} Relays the computed value returned from the operational callback closure
     */
    async transaction(callback) {
        throw new Error("NotificationRepository.transaction() must be implemented.");
    }
}