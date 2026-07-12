export class IRepository {
  constructor() {
    if (this.constructor === IRepository) {
      throw new Error('IRepository is an abstract interface and cannot be instantiated directly.');
    }
  }

  /**
   * Retrieves an aggregate root by its unique identity
   * @abstract
   * @param {string} id 
   * @param {any} [transactionContext] - Optional infrastructure transaction reference (e.g. Knex transaction block)
   * @returns {Promise<import('../../shared-kernel/AggregateRoot.js').AggregateRoot|null>}
   */
  async getById(id, transactionContext = null) {
    throw new Error('Method getById() must be implemented by Infrastructure layer.');
  }

  /**
   * Saves or updates an aggregate root inside the collection
   * @abstract
   * @param {import('../../shared-kernel/AggregateRoot.js').AggregateRoot} aggregate 
   * @param {any} [transactionContext] 
   * @returns {Promise<void>}
   */
  async save(aggregate, transactionContext = null) {
    throw new Error('Method save() must be implemented by Infrastructure layer.');
  }

  /**
   * Removes an aggregate root from the collection
   * @abstract
   * @param {string} id 
   * @param {any} [transactionContext] 
   * @returns {Promise<void>}
   */
  async delete(id, transactionContext = null) {
    throw new Error('Method delete() must be implemented by Infrastructure layer.');
  }
}