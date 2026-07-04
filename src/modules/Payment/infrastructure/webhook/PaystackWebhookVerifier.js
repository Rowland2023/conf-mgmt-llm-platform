import crypto from 'crypto';

export class PaystackWebhookVerifier {
  constructor(secretKey, { logger = console } = {}) {
    if (!secretKey) {
      throw new Error('Paystack configuration parameters initialization failure: missing required secretKey credentials.');
    }
    this.secretKey = secretKey;
    this.logger = logger;
  }

  verify(rawBody, signatureHeader) {
    if (!signatureHeader) {
      const err = new Error('Security Validation Failure: Missing x-paystack-signature authorization header.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Compute the local HMAC signature digest from the raw body buffer
    const computedHash = crypto
      .createHmac('sha256', this.secretKey) // Note: Paystack standard HMAC utilizes sha256 hex signatures
      .update(rawBody, 'utf8')
      .digest('hex');

    // 2. FIXED: Structural length safeguard check to prevent timingSafeEqual process crashes
    if (!computedHash || !signatureHeader || computedHash.length !== signatureHeader.length) {
      this.logger.warn('Paystack webhook signature length mismatch detected');
      const err = new Error('Unauthorized webhook signature mismatch.');
      err.statusCode = 401;
      throw err;
    }

    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'utf8'),
      Buffer.from(signatureHeader, 'utf8')
    );

    if (!isAuthentic) {
      this.logger.error('Paystack webhook cryptographic signature verification failed');
      const err = new Error('Unauthorized webhook signature mismatch.');
      err.statusCode = 401;
      throw err;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      const err = new Error('Malformed JSON payload body parsing error.');
      err.statusCode = 400;
      throw err;
    }

    const data = payload.data || {};

    // 3. FIXED: Extract unique tracking telemetry identifiers to enforce strict idempotency
    // Paystack delivers a unique transmission key on modern webhook infrastructure via payload.event_id
    // Fall back to a combination string of event type + transaction ID if legacy frames are encountered
    const uniqueDeliveryId = payload.event_id || `evt_${payload.event}_${data.id}`;

    return {
      provider: 'paystack',
      eventType: payload.event,
      
      // CRITICAL IDEMPOTENCY TRACKING FIELD: Use this to enforce single-processing DB constraints
      eventId: uniqueDeliveryId, 
      
      bookingId: data.metadata?.booking_id || data.metadata?.order_id || null,
      transactionId: data.id ? String(data.id) : null,
      reference: data.reference || null, // Capture Paystack's client reference string
      
      amountInMinorUnits: data.amount ? Number(data.amount) : 0,
      currency: data.currency ? String(data.currency).toUpperCase() : null,
      
      livemode: payload.event ? !this.secretKey.startsWith('sk_test_') : false,
      rawEvent: payload
    };
  }
}