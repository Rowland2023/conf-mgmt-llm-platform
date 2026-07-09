// infrastructure/observability/logger.js
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  // Format as pure JSON objects for indexing engines
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Automatically extracts full stacks from Error objects
    winston.format.json()
  ),
  defaultMeta: { 
    service: process.env.SERVICE_NAME || "event-service",
    environment: process.env.NODE_ENV || "production"
  },
  transports: [
    new winston.transports.Console({
      // High-performance direct stream writing
      stderrLevels: ["error"],
    }),
  ],
});

/**
 * Production logging utility wrapper supporting explicit context injection
 */
export const Logger = {
  info: (message, context = {}) => logger.info(message, context),
  warn: (message, context = {}) => logger.warn(message, context),
  error: (message, error = null, context = {}) => {
    const meta = { ...context };
    if (error instanceof Error) {
      meta.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    } else if (error) {
      meta.error = error;
    }
    logger.error(message, meta);
  },
  debug: (message, context = {}) => logger.debug(message, context),
};