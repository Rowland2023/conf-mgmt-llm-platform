import { ILogger } from '../interfaces/ILogger.js';

export class TestLoggerAdapter extends ILogger {
  constructor({ silent = true } = {}) {
    super();
    this.silent = silent;
    /** @type {Array<{level: string, message: string, ctx: any}>} */
    this.logs = []; 
  }

  debug(message, context = {}) {
    this._capture('debug', message, context);
  }

  info(message, context = {}) {
    this._capture('info', message, context);
  }

  warn(message, errorOrContext = {}) {
    this._capture('warn', message, errorOrContext);
  }

  error(message, errorOrContext = {}) {
    this._capture('error', message, errorOrContext);
  }

  _capture(level, message, ctx) {
    this.logs.push({ level, message, ctx });
    if (!this.silent) {
      console[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}] ${message}`, ctx);
    }
  }

  clear() {
    this.logs = [];
  }
}