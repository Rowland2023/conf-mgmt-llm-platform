
//It does exactly what infrastructure/cache/RedisClient.js should do:

//Establish a connection to Redis ✅
//Manage Redis configuration (host, port) ✅
//Handle connection events ✅
//Export a reusable Redis client that other infrastructure components can use ✅


// infrastructure/cache/RedisClient.js

import Redis from "ioredis";

class RedisClient {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,

      retryStrategy(times) {
        // Retry with exponential backoff, max 3 seconds
        return Math.min(times * 100, 3000);
      },

      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    this.registerEvents();
    this.registerShutdown();
  }

  registerEvents() {
    this.client.on("connect", () => {
      console.log("Redis connected");
    });

    this.client.on("ready", () => {
      console.log("Redis ready to receive commands");
    });

    this.client.on("reconnecting", () => {
      console.log("Redis reconnecting...");
    });

    this.client.on("error", (error) => {
      console.error("Redis error:", error);
    });

    this.client.on("close", () => {
      console.warn("Redis connection closed");
    });
  }

  registerShutdown() {
    const shutdown = async () => {
      try {
        console.log("Closing Redis connection...");
        await this.client.quit();
        console.log("Redis disconnected");
        process.exit(0);
      } catch (error) {
        console.error("Failed to close Redis:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  getClient() {
    return this.client;
  }
}

// Singleton instance
const redisClient = new RedisClient();

export default redisClient.getClient();