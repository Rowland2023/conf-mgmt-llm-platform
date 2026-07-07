// src/shared/infrastructure/database/knex.js
import knex from 'knex';
import pg from 'pg';

const { types } = pg;

// 1. DETERMINISTIC TYPE SYSTEM PARSING
// Safely unpack 64-bit integer rows directly into native JS number fields
types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));

// NOTE: If handling financial ledgers, remove parseFloat and use a decimal library inside domain.
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
  throw new Error('FATAL: DB_PASSWORD configuration missing in production environment');
}

const statementTimeout = Number(process.env.DB_STATEMENT_TIMEOUT) || 30000;

const knexConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'event_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    application_name: process.env.SERVICE_NAME || 'event-service',
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
      : process.env.DB_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
    createTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
    
    // Wire up driver lifecycle telemetry to escape unexpected silent background thread collapses
    afterCreate: (conn, done) => {
      // Apply statement-level timeouts natively across all pooled connections
      conn.query(`SET statement_timeout = ${statementTimeout}`, (err) => {
        if (err) return done(err, conn);
        
        conn.on('error', (err) => {
          console.error('CRITICAL: Unexpected database client socket error:', err.message);
        });
        
        done(null, conn);
      });
    },
  },
  // Protect resources from holding dead transactions indefinitely if an application server crashes mid-stream
  acquireConnectionTimeout: 10000,
};

// Initialize the single database manager instance
const db = knex(knexConfig);

/**
 * Clean Operational Diagnostics & Lifecycles
 */
export const dbDiagnostics = {
  /**
   * Fail-Fast Orchestration Health Engine
   * Restricts checking windows to a tight deadline so Kubernetes liveness/readiness probes
   * don't hang if the database cluster goes split-brain or becomes saturated.
   */
  async healthCheck() {
    try {
      // Uses a dedicated shallow connection request with an aggressive time runtime threshold guard
      await db.raw('SELECT 1').timeout(2000, { cancel: true });
    } catch (error) {
      console.error('Health check execution failed:', error.message);
      throw new Error(`Database health degraded: ${error.message}`);
    }
  },

  /**
   * Graceful Shutdown Handler
   */
  async close() {
    try {
      console.log('Draining Knex database connection pool safely...');
      await db.destroy();
      console.log('Knex database pool has terminated cleanly.');
    } catch (error) {
      console.error('Error during Knex pool termination:', error);
      throw error;
    }
  }
};

export default db;