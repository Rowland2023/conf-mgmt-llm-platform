import request from 'supertest';
import express from 'express';
import { rateLimit } from './rateLimit.js';

describe('Rate Limiter Middleware Regression Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    // Setup a strict rate limit for testing: 2 requests per window
    app.use('/test-limit', rateLimit({
      id: 'test-route',
      windowMs: 5000,
      max: 2,
      keyMode: 'ip'
    }), (req, res) => res.status(200).json({ success: true }));
  });

  it('should allow requests under the threshold and block subsequent requests', async () => {
    // Request 1: Allowed
    await request(app).get('/test-limit').expect(200);
    
    // Request 2: Allowed
    await request(app).get('/test-limit').expect(200);

    // Request 3: Bypasses threshold -> Should be blocked (429)
    const response = await request(app).get('/test-limit').expect(429);
    
    expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.headers['retry-after']).toBeDefined();
  });
});