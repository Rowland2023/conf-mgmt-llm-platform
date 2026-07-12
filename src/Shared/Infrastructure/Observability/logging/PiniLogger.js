// shared/infrastructure/logging/PinoLogger.js
import pino from 'pino';
import { ILogger } from '../../application/ILogger.js';

export class PinoLogger extends ILogger {
  constructor(opts = {}) {
    super();
    this.logger = pino(opts);
  }
  info(msg, meta) { this.logger.info(meta, msg); }
  warn(msg, meta) { this.logger.warn(meta, msg); }
  error(msg, meta) { this.logger.error(meta, msg); }
  debug(msg, meta) { this.logger.debug(meta, msg); }
  child(bindings) { return new PinoLogger({ ...this.logger.bindings(), ...bindings }); }
}