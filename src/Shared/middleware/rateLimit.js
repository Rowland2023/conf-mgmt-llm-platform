import rateLimitMiddleware from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import crypto from 'crypto';

// Initialize Redis client only if a URL is provided
const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false, // Fail fast instantly during network drops
      maxRetriesPerRequest: 3,
      lazyConnect: true // Delay actual socket generation until the first hit
    })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => {
    console.error('Systemic Redis Rate-Limiter Async Connection Error Event:', err);
  });
}

if (!redisClient && process.env.NODE_ENV === 'production') {
  console.warn('CRITICAL CONFIGURATION ERROR: RateLimit running without Redis. Limits will not sync across infrastructure instances.');
}

// 12-character SHA1 hash for privacy-safe logs/keys
const hashIp = (ip) => crypto.createHash('sha1').update(ip || 'unknown').digest('hex').slice(0, 12);

/**
 * Hardened distributed endpoint connection throttling middleware layer.
 */
export const rateLimit = ({
  max,
  windowMs,
  id,
  store,
  keyMode = 'auto',
  skipSuccessfulRequests = false
}) => {
  // Production guardrails
  if (!id && process.env.NODE_ENV === 'production') {
    throw new Error('RateLimit Initialization Failure: "id" string attribute is required to isolate key spaces.');
  }

  const defaultStore = redisClient
    ? new RedisStore({
        prefix: `rl:${id}:`,
        sendCommand: (...args) => redisClient.call(...args)
      })
    : undefined;

  if (!store && !defaultStore && process.env.NODE_ENV === 'production') {
    throw new Error('RateLimit Runtime Error: Redis required for multi-instance production execution paths.');
  }

  return rateLimitMiddleware({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: store || defaultStore,
    skipSuccessfulRequests,
    skip: (req) => req.path === '/health' || req.path === '/metrics',
    
    // FIX 1: Explicitly pass false to silence all built-in configuration logs/warnings
    validate: false,
    
    keyGenerator: (req) => {
      // Priority 1: User Database Authentication Record
      if (keyMode === 'user' || keyMode === 'auto') {
        if (req.user?.id) return `user:${req.user.id}`;
        if (keyMode === 'user') {
          req.log?.error({ path: req.path, limitId: id }, 'RateLimit configured for user tracking mode but found no active auth session context');
        }
      }

      // Priority 2: Hardware Device Verification Fingerprint String
      const deviceId = req.headers['x-device-id'];
      if (deviceId && typeof deviceId === 'string' && deviceId.trim() !== '') {
        const sanitizedDevice = deviceId.length > 64 ? hashIp(deviceId) : deviceId.trim();
        return `device:${sanitizedDevice}`;
      }

      // Priority 3: Privacy-Safe Hashed Client Networking Address
      // FIX 2: Check for Express trust proxy configuration if available, otherwise safely parse client array
      const ip = (req.ips && req.ips.length ? req.ips[0] : req.ip) || 'unknown-client';
      return `ip:${hashIp(ip)}`;
    },
    
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfter = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(windowMs / 1000);

      req.log?.warn({
        key: req.rateLimit?.key,
        path: req.path,
        limitId: id
      }, 'API route client transaction threshold limit exceeded');

      res.set('Retry-After', String(retryAfter));
      
      res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests hitting this endpoint. Please throttle execution pacing loops and retry later.',
        retryAfterSeconds: retryAfter
      });
    }
  });
};