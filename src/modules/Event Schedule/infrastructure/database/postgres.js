import pg from "pg";

const { Pool, types } = pg;

// 1. DETERMINISTIC TYPE SYSTEM PARSING
// Safely unpack 64-bit integer rows directly into native JS number fields
types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));

// NOTE: If handling financial ledgers, remove parseFloat and use a decimal library inside domain.
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

class PostgresClient {
  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD) {
      throw new Error('FATAL: DB_PASSWORD configuration missing in production environment');
    }

    const statementTimeout = Number(process.env.DB_STATEMENT_TIMEOUT) || 30000;

    this.pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "event_db",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      max: Number(process.env.DB_POOL_MAX) || 20,
      
      // UPGRADE: Configurable timeout options fed via environment infrastructure parameters
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT) || 5000,
      
      // UPGRADE: Natively handled by newer node-postgres drivers, safer for PgBouncer / Connection Proxies
      statement_timeout: statementTimeout, 
      
      application_name: process.env.SERVICE_NAME || 'event-service',
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
        : process.env.DB_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
    });

    this.registerEvents();
  }

  registerEvents() {
    // Escapes client network disconnect anomalies from breaking the primary Node thread
    this.pool.on("connect", (client) => {
      client.on("error", (err) => {
        console.error("CRITICAL: Unexpected database client socket error:", err.message);
      });
    });

    this.pool.on("error", (error) => {
      console.error("CRITICAL: Unexpected idle connection pool worker error:", error.message);
    });
  }

  getPool() { 
    return this.pool; 
  }

  async query(text, params) { 
    return this.pool.query(text, params); 
  }

  async getClient() { 
    return this.pool.connect(); 
  }

  /**
   * Fail-Fast Orchestration Health Engine
   * Restricts checking windows to a tight deadline so Kubernetes liveness/readiness probes
   * don't hang if the database cluster goes split-brain or becomes saturated.
   */
  async healthCheck() { 
    try {
      await this.pool.query({
        text: 'SELECT 1',
        statement_timeout: 2000 // Fast timeout threshold protection
      }); 
    } catch (error) {
      console.error("Health check execution failed:", error.message);
      throw new Error(`Database health degraded: ${error.message}`);
    }
  }

  async close() {
    try {
      console.log("Draining PostgreSQL connection pool safely...");
      await this.pool.end();
      console.log("PostgreSQL pool has terminated cleanly.");
    } catch (error) {
      console.error("Error during PostgreSQL pool termination:", error);
      throw error;
    }
  }
}

const postgres = new PostgresClient();
export default postgres;