export class ILogger {
  constructor() {
    if (this.constructor === ILogger) {
      throw new Error('ILogger is an abstract interface and cannot be instantiated directly.');
    }
  }

  /**
   * Log fine-grained informational events useful for debugging
   * @abstract
   * @param {string} message 
   * @param {Object} [context] 
   */
  debug(message, context = {}) {
    throw new Error('Method debug() must be implemented.');
  }

  /**
   * Log high-level operational tracking statuses
   * @abstract
   * @param {string} message 
   * @param {Object} [context] 
   */
  info(message, context = {}) {
    throw new Error('Method info() must be implemented.');
  }

  /**
   * Log unexpected application runtime exceptions or warning alerts
   * @abstract
   * @param {string} message 
   * @param {Error|Object} [errorOrContext] 
   */
  warn(message, errorOrContext = {}) {
    throw new Error('Method warn() must be implemented.');
  }

  /**
   * Log fatal framework crashes or business logic exceptions that halted processing
   * @abstract
   * @param {string} message 
   * @param {Error|Object} [errorOrContext] 
   */
  error(message, errorOrContext = {}) {
    throw new Error('Method error() must be implemented.');
  }
}