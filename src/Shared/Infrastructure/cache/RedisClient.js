import Redis from "ioredis";

/**
 * Production-grade Redis client lifecycle wrapper.
 * Managed as an infrastructural instance dependency injected into modules.
 */
export class RedisClient {
    constructor({ logger = console, config = {} } = {}) {
        this.logger = logger;

        this.client = new Redis({
            host: config.host ?? process.env.REDIS_HOST ?? "127.0.0.1",
            port: Number(config.port ?? process.env.REDIS_PORT ?? 6379),
            password: config.password ?? process.env.REDIS_PASSWORD ?? undefined,
            db: Number(config.db ?? process.env.REDIS_DB ?? 0),

            lazyConnect: true,         // Controlled explicit boot sequence execution
            enableReadyCheck: true,    // Ensure cluster validation state verification passes
            
            // CRITICAL: Must be null when using a custom retryStrategy. 
            // This prevents ioredis from deadlocking the command queue during initialization drops.
            maxRetriesPerRequest: null,

            retryStrategy(times) {
                // Exponential backoff capped at 3 seconds max interval window
                const delay = Math.min(times * 100, 3000);
                return delay;
            },

            reconnectOnError(error) {
                // Instantly re-route socket allocations on cluster replica failover events
                return error.message.includes("READONLY");
            }
        });

        this.connected = false;
        this.#registerEvents();
    }

    /**
     * @private
     */
    #registerEvents() {
        this.client.on("connect", () => {
            this.logger.info?.("Redis TCP link layer connection established.");
        });

        this.client.on("ready", () => {
            this.connected = true;
            this.logger.info?.("Redis client state verified READY.");
        });

        this.client.on("reconnecting", () => {
            this.connected = false;
            this.logger.warn?.("Redis socket link severed. Reconnecting...");
        });

        this.client.on("close", () => {
            this.connected = false;
            this.logger.warn?.("Redis connection pool closed cleanly.");
        });

        this.client.on("end", () => {
            this.connected = false;
            this.logger.info?.("Redis cluster link engine processing ended.");
        });

        this.client.on("error", (error) => {
            // Guard against logging verbose trace streams during standard connection drops
            this.logger.error?.("Redis core connection failure exception:", { message: error.message });
        });
    }

    /**
     * Establish the Redis connection and await functional verification.
     * Guarded with a strict timeout boundary to prevent hanging application startup.
     */
    async connect(timeoutMs = 10000) {
        if (this.connected) return;

        let timeoutTracker = null;

        await new Promise((resolve, reject) => {
            const cleanUpListeners = () => {
                if (timeoutTracker) clearTimeout(timeoutTracker);
                this.client.off("ready", onReady);
                this.client.off("end", onEnd);
            };

            const onReady = () => {
                cleanUpListeners();
                resolve();
            };

            const onEnd = () => {
                cleanUpListeners();
                reject(new Error("Redis connection ended prematurely during initialization handshake."));
            };

            timeoutTracker = setTimeout(() => {
                cleanUpListeners();
                reject(new Error(`Redis connection handshake timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            // Bind to definitive structural lifecycle events instead of volatile error hooks
            this.client.once("ready", onReady);
            this.client.once("end", onEnd);

            // Trigger the explicit connect chain
            this.client.connect().catch((err) => {
                cleanUpListeners();
                reject(err);
            });
        });
    }

    /**
     * Gracefully disconnect Redis instance pools.
     */
    async disconnect() {
        if (!this.client) return;

        this.connected = false;
        // .quit() executes background transactional command draining before dropping sockets
        await this.client.quit();
    }

    /**
     * Returns true when Redis is ready.
     */
    isReady() {
        return this.connected;
    }

    /**
     * Exposes the underlying ioredis client safely.
     */
    getClient() {
        return this.client;
    }
}