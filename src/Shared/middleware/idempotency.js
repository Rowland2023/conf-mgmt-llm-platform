import Redis from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true
});

const LOCK_TTL_SECONDS = 600;
const CACHE_TTL_SECONDS = 86400;

const IDEMPOTENCY_LUA = `
  local lockKey = KEYS[1]
  local inFlightValue = ARGV[1]
  local ttl = ARGV[2]
  local existing = redis.call('GET', lockKey)
  if not existing then
    redis.call('SET', lockKey, inFlightValue, 'EX', ttl)
    return {'ACQUIRED'}
  end
  return {'EXISTS', existing}
`;

export const idempotency = ({ requireKey = true } = {}) => {
  return async (req, res, next) => {
    const key = req.headers['x-idempotency-key'];
    if (!key && requireKey) {
      return res.status(400).json({
        error: 'Idempotency Violation',
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'X-Idempotency-Key header required.'
      });
    }
    if (!key) return next();

    const contextUser = req.user?.id || 'anonymous';
    const lockKey = `idempotency:${contextUser}:${req.method}:${req.path}:${key}`;
    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

    try {
      const result = await redis.eval(IDEMPOTENCY_LUA, 1, lockKey, `IN_FLIGHT:${bodyHash}`, LOCK_TTL_SECONDS);

      if (result[0] === 'EXISTS') {
        const existingRecord = result[1];
        if (existingRecord.startsWith('IN_FLIGHT')) {
          const [, inFlightHash] = existingRecord.split(':');
          if (inFlightHash!== bodyHash) {
            return res.status(422).json({
              error: 'Unprocessable Entity',
              code: 'IDEMPOTENCY_KEY_REUSE',
              message: 'Key used with different request body.'
            });
          }
          return res.status(409).json({
            error: 'Conflict',
            code: 'REQUEST_IN_PROGRESS',
            message: 'Request already processing.'
          });
        }

        let cached;
        try {
          cached = JSON.parse(existingRecord);
        } catch {
          await redis.del(lockKey);
          return res.status(409).json({ error: 'Conflict', message: 'Retry request.' });
        }

        if (cached.bodyHash!== bodyHash) {
          return res.status(422).json({
            error: 'Unprocessable Entity',
            code: 'IDEMPOTENCY_KEY_REUSE',
            message: 'Key used with different request body.'
          });
        }

        res.set('X-Cache', 'HIT');
        res.set('Content-Type', cached.headers?.['content-type'] || 'application/json');
        const body = cached.isBuffer? Buffer.from(cached.body, 'base64') : cached.body;
        return res.status(cached.status).send(body);
      }

      // Lock acquired
      req.idempotencyKey = key;
      res.set('X-Cache', 'MISS');

      const heartbeat = setInterval(() => {
        redis.expire(lockKey, LOCK_TTL_SECONDS).catch(() => {});
      }, (LOCK_TTL_SECONDS * 500));
      const clearHeartbeat = () => clearInterval(heartbeat);
      res.on('finish', clearHeartbeat);
      res.on('close', clearHeartbeat);

      res._idempotencyProcessed = false;
      const intercept = (orig) => function (body) {
        if (res._idempotencyProcessed) return orig.call(this, body);
        res._idempotencyProcessed = true;

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = JSON.stringify({
            status: res.statusCode,
            body: Buffer.isBuffer(body)? body.toString('base64') : body,
            isBuffer: Buffer.isBuffer(body),
            headers: { 'content-type': res.get('Content-Type') },
            bodyHash
          });
          redis.set(lockKey, payload, 'EX', CACHE_TTL_SECONDS).catch(() => {});
        } else {
          redis.del(lockKey).catch(() => {});
        }
        return orig.call(this, body);
      };

      res.json = intercept(res.json.bind(res));
      res.send = intercept(res.send.bind(res));

      const origEnd = res.end;
      res.end = function (chunk, enc) {
        if (!res._idempotencyProcessed) {
          res._idempotencyProcessed = true;
          if (res.statusCode < 200 || res.statusCode >= 300) redis.del(lockKey).catch(() => {});
        }
        return origEnd.call(this, chunk, enc);
      };

      next();
    } catch (error) {
      req.log?.error({ error, lockKey }, 'Idempotency breakdown');
      return res.status(503).json({
        error: 'Service Unavailable',
        code: 'IDEMPOTENCY_CHECK_FAILED',
        message: 'Try again.'
      });
    }
  };
};
