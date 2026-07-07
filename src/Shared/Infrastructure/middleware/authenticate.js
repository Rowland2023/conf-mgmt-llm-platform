// src/shared/infrastructure/middlewares/authenticate.js
// src/shared/infrastructure/middleware/authenticate.js
import jwt from 'jsonwebtoken';

// Fallback to a mock secret ONLY during automated testing profiles
const isTestEnv = process.env.NODE_ENV === 'test';
if (!process.env.JWT_ACCESS_SECRET && !isTestEnv) {
  throw new Error('CRITICAL CONFIG ERROR: process.env.JWT_ACCESS_SECRET is not defined.');
}

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test_fallback_jwt_secret_do_not_use_in_prod';
const ALLOWED_ALGORITHMS = ['HS256'];

export function authenticate(req, res, next) {
  // ... rest of the middleware remains exactly the same
  try {
    const rawHeader = req.headers.authorization;

    // Type guard against array contamination or non-string inputs
    if (!rawHeader || typeof rawHeader !== 'string' || !rawHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_TOKEN_MISSING',
        message: 'Bearer token is required.'
      });
    }

    const token = rawHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_TOKEN_MISSING',
        message: 'Bearer token cannot be empty.'
      });
    }

    // Verify token identity using a single immutable configuration reference
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ALLOWED_ALGORITHMS
    });

    // Validate essential identity payload before attaching to request context
    if (!payload.sub) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_TOKEN_CLAIMS',
        message: 'Token identity context is invalid.'
      });
    }

    // Standardize identity profile object across subsequent route handlers
    req.user = {
      id: payload.sub,
      email: payload.email || null,
      role: payload.role || null,
      roles: payload.roles ?? (payload.role ? [payload.role] : [])
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired.'
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
        message: 'Access token signature is invalid.'
      });
    }

    // Pass unexpected internal system errors safely to your global error handler middleware
    return next(error);
  }
}