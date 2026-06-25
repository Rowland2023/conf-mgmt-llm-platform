/**
 * Domain error thrown when an infrastructure resource constraint 
 * violation occurs due to a duplicate primary or unique key.
 */
export class DuplicateKeyError extends Error {
  /**
   * @param {string} message - Human-readable diagnostic failure context
   */
  constructor(message) {
    super(message);
    this.name = 'DuplicateKeyError';
    
    // Captures a clean stack trace up to where this domain error was instantiated,
    // ensuring internal error constructor boilerplate doesn't pollute the logs.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}