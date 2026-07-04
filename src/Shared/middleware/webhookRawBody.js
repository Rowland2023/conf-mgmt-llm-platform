import express from 'express';

/**
 * Captures raw body for webhook signature verification.
 * Must be mounted BEFORE express.json() on webhook routes.
 * 
 * @param {Object} options
 * @param {string} options.limit - Max body size. Default '512kb'.
 */
export const webhookRawBody = ({ limit = '512kb' } = {}) => {
  return express.raw({
    type: 'application/json',
    limit,
    verify: (req, res, buf) => {
      if (!buf || !buf.length) return;
      
      // Store raw Buffer - required for HMAC verification
      req.rawBody = buf;
      
      // Also store string for libs that need it. Always UTF-8 for JSON webhooks.
      // If buffer has invalid UTF-8 sequences, toString will insert replacement chars,
      // which breaks HMAC. In that case, signature verification will fail correctly.
      try {
        req.rawBodyString = buf.toString('utf8');
      } catch {
        // Fallback: latin1 is 1:1 byte mapping, preserves data for manual crypto
        req.rawBodyString = buf.toString('latin1');
      }
    }
  });
};
