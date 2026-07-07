import app from './app.module.js';
import {
  verifyDatabaseConnection,
  closeDatabaseConnection,
} from './shared/infrastructure/database/knex.js';

const PORT = process.env.PORT || 3000;

let server;

/**
 * Gracefully shuts down the application.
 */
async function shutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Stop accepting new HTTP requests
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      console.log('✅ HTTP server stopped.');
    }

    // Close Knex connection pool
    await closeDatabaseConnection();
    console.log('✅ Database connection pool closed.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Handle termination signals
 */
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

/**
 * Bootstraps the application.
 */
async function start() {
  try {
    await verifyDatabaseConnection();
    console.log('📡 Database connected successfully.');

    server = app.listen(PORT, () => {
      console.log(`🚀 Conference Management API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start application.');
    console.error(error);
    process.exit(1);
  }
}

start();