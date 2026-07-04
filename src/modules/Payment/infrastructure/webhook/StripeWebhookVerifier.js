import Stripe from 'stripe';

// FIXED: Switched charge.refunded to refund.created to completely eliminate cumulative math errors
const SUPPORTED_EVENTS = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'checkout.session.completed',
  'refund.created'
]);

export class StripeWebhookVerifier {
  constructor(apiKey, webhookSecret, { apiVersion, tolerance = 300, logger = console } = {}) {
    if (!apiKey || !webhookSecret) {
      throw new Error('Stripe configuration parameters initialization failure: missing required credentials.');
    }
    // Set explicit SDK pinning to guarantee stable property lookups
    this.stripe = new Stripe(apiKey, { apiVersion: apiVersion || '2025-01-27.acacia' });
    this.webhookSecret = webhookSecret;
    this.tolerance = tolerance; 
    this.logger = logger;
  }

  verify(rawBody, signatureHeader) {
    if (!signatureHeader) {
      const err = new Error('Security Validation Failure: Missing stripe-signature authorization header.');
      err.statusCode = 400;
      err.code = 'MISSING_SIGNATURE';
      throw err;
    }

    // NOTE: rawBody MUST be an unparsed string or Buffer straight from the HTTP stream.
    // Re-stringifying a pre-parsed JSON object will break HMAC validation due to whitespace variations.
    let event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.webhookSecret,
        this.tolerance
      );
    } catch (err) {
      this.logger.warn({
        type: err.type,
        message: err.message
      }, 'Stripe webhook signature cryptographic verification failed');

      const error = new Error('Invalid signature fingerprint verification failed.');
      error.statusCode = 400; 
      error.code = 'WEBHOOK_INVALID_SIGNATURE';
      throw error;
    }

    // Replay protection layer against delayed delivery interceptions
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - event.created);
    if (ageSeconds > 3600) {
      this.logger.warn({ eventId: event.id, ageSeconds }, 'Intercepted a stale replayed webhook event payload');
      const err = new Error('Security Boundary Exception: Webhook transaction timestamp is stale.');
      err.statusCode = 400;
      throw err;
    }

    // Quietly pass over unhandled events with a standard acknowledgment frame
    if (!SUPPORTED_EVENTS.has(event.type)) {
      this.logger.info({ type: event.type, id: event.id }, 'Ignoring unsupported hook transaction type context');
      const err = new Error('Event structural type not handled by this consumer implementation.');
      err.statusCode = 200; 
      err.ignored = true;
      throw err;
    }

    return this.toInternalContract(event);
  }

  toInternalContract(event) {
    const obj = event.data.object;

    // FIXED: Individual transaction value isolation mapping matrix
    const amount = (() => {
      switch (event.type) {
        case 'payment_intent.succeeded':   return obj.amount_received;
        case 'payment_intent.payment_failed': return obj.amount;
        case 'refund.created':               return obj.amount; // Isolates the precise value of this transaction single-instance
        case 'checkout.session.completed':   return obj.amount_total;
        default:                              return obj.amount || 0;
      }
    })();

    // FIXED: Resilient multi-layer metadata extraction architecture
    // Scans the source event objects systematically across known inheritance boundaries
    const bookingId = 
      obj.metadata?.booking_id || 
      obj.metadata?.order_id || 
      obj.payment_intent?.metadata?.booking_id ||
      null;

    // FIXED: Surface structural error messages for failure analytical tracking pipelines
    const failureReason = event.type === 'payment_intent.payment_failed'
      ? {
          code: obj.last_payment_error?.code || 'unknown_decline',
          message: obj.last_payment_error?.message || 'Card transaction declined by issuing institution.'
        }
      : null;

    return {
      provider: 'stripe',
      eventType: event.type,
      eventId: event.id, // CRITICAL: Write this to a unique index in your database to enforce absolute processing idempotency
      bookingId,
      transactionId: obj.id,
      paymentIntentId: event.type === 'refund.created' 
        ? (obj.payment_intent || obj.charge) 
        : (obj.payment_intent || obj.id),
      amountInMinorUnits: amount,
      currency: obj.currency?.toUpperCase(),
      livemode: event.livemode,
      created: event.created,
      failureReason,
      rawEvent: event
    };
  }
}