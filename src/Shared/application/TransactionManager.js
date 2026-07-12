export class TransactionManager {
  /**
   * @param {function(any): Promise<T>} operation
   * @param {Object} [options]
   * @param {'read_committed'|'repeatable_read'|'serializable'} [options.isolationLevel]
   * @param {number} [options.timeoutMs]
   * @returns {Promise<T>}
   * @template T
   */
  async runInTransaction(operation, options = {}) {
    throw new Error('Method runInTransaction() must be implemented by Infrastructure layer.');
  }
}