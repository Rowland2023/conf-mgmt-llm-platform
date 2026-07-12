import winston from 'winston';
import { ILogger } from '../interfaces/ILogger.js';

export class WinstonLoggerAdapter extends ILogger {
  /**
   * @param {Object} [options] 
   * @param {string} [options.logLevel] - 'debug' | 'info' | 'warn' | 'error'
   */
  constructor({ logLevel = 'info' } = {}) {
    super();

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  debug(message, context = {}) {
    this.logger.debug(message, context);
  }

  info(message, context = {}) {
    this.logger.info(message, context);
  }

  warn(message, errorOrContext = {}) {
    const payload = this._formatErrorContext(errorOrContext);
    this.logger.warn(message, payload);
  }

  error(message, errorOrContext = {}) {
    const payload = this._formatErrorContext(errorOrContext);
    this.logger.error(message, payload);
  }

  /**
   * Internal helper to make sure native JS Error properties (like stacks)
   * parse out correctly into JSON streams.
   */
  _formatErrorContext(input) {
    if (input instanceof Error) {
      return {
        error: {
          name: input.name,
          message: input.message,
          stack: input.stack
        }
      };
    }
    return input;
  }
}