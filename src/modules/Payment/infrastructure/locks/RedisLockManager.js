import { randomUUID } from 'crypto';

export class RedisLockManager {
  /**
   * @param {import('ioredis').Redis} redisClient
   * @param {Object} [options]
   * @param {string} [options.namespace='app']
   * @param {Object} [options.logger=console]
   */
  constructor(redisClient, { namespace = 'app', logger = console } = {}) {
    this.redis = redisClient;
    this.ns = namespace;
    this.logger = logger;

    // Only define commands if they don't already exist on this instance
    if (typeof this.redis.safeReleaseLock !== 'function') {
      this.redis.defineCommand('safeReleaseLock', {
        numberOfKeys: 1,
        lua: `
          if redis.call("get", KEYS[1]) == ARGV[1] then 
            return redis.call("del", KEYS[1]) 
          else 
            return 0 
          end`,
      });
    }

    if (typeof this.redis.safeExtendLock !== 'function') {
      this.redis.defineCommand('safeExtendLock', {
        numberOfKeys: 1,
        lua: `
          if redis.call("get", KEYS[1]) == ARGV[1] then 
            return redis.call("pexpire", KEYS[1], ARGV[2]) 
          else 
            return 0 
          end`,
      });
    }
  }

  _key(resource) {
    return `${this.ns}:lock:${resource}`;
  }

  /**
   * @param {string} resource 
   * @param {number} ttl - Milliseconds
   */
  async acquireLock(resource, ttl) {
    if (!resource) throw new Error('Resource name is required');
    if (!ttl || ttl < 1000) throw new Error('TTL must be >= 1000ms');

    const key = this._key(resource);
    const token = randomUUID();

    try {
      const result = await this.redis.set(key, token, 'NX', 'PX', ttl);
      return result === 'OK' ? { resource, token } : null;
    } catch (error) {
      this.logger.error({ err: error, key, action: 'acquire' }, 'Lock acquire failed');
      return null;
    }
  }

  /**
   * Safely releases a lock. Accepts either the full lock object or manual parameters.
   * @param {Object|string} lockOrResource - The lock object returned from acquireLock, or the resource string
   * @param {string} [explicitToken] - Required only if the first argument is a string
   */
  async releaseLock(lockOrResource, explicitToken) {
    if (!lockOrResource) return false;

    // Duck-typing to extract parameters cleanly
    const resource = typeof lockOrResource === 'string' ? lockOrResource : lockOrResource.resource;
    const token = typeof lockOrResource === 'string' ? explicitToken : lockOrResource.token;

    if (!resource || !token) {
      this.logger.warn({ resource, hasToken: !!token }, 'Missing required parameters for lock release');
      return false;
    }

    const key = this._key(resource);
    try {
      const result = await this.redis.safeReleaseLock(key, token);
      return result === 1;
    } catch (error) {
      this.logger.error({ err: error, key, action: 'release' }, 'Lock release failed');
      return false;
    }
  }

  /**
   * Safely extends an existing lock's TTL.
   * @param {Object|string} lockOrResource 
   * @param {string|number} tokenOrTtl - The token (if first arg is string) OR the new TTL (if first arg is object)
   * @param {number} [explicitTtl] - The new TTL (if first arg is string)
   */
  async extendLock(lockOrResource, tokenOrTtl, explicitTtl) {
    if (!lockOrResource) return false;

    const resource = typeof lockOrResource === 'string' ? lockOrResource : lockOrResource.resource;
    const token = typeof lockOrResource === 'string' ? tokenOrTtl : lockOrResource.token;
    const ttl = typeof lockOrResource === 'string' ? explicitTtl : tokenOrTtl;

    if (!resource || !token || !ttl || ttl < 1000) {
      this.logger.warn({ resource, hasToken: !!token, ttl }, 'Invalid parameters for lock extension');
      return false;
    }

    const key = this._key(resource);
    try {
      const result = await this.redis.safeExtendLock(key, token, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error({ err: error, key, action: 'extend' }, 'Lock extend failed');
      return false;
    }
  }
}