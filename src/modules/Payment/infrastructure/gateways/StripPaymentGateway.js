export class StripePaymentGateway {
  constructor(apiKey,{ apiVersion, logger = console } = {}) {
    if (!apiKey) throw new Error('Stripe API Key required');
    this.stripe = new Stripe(apiKey, { apiVersion: apiVersion || '2025-01-27.acacia' });  
    this.logger = logger;
  }

  async charge({ 
    amountInCents, 
    currency, 
    paymentMethodId, 
    idempotencyKey, 
    returnUrl, 
    customerId, 
    offSession = false,
    bookingId,      // Required for audit
    userId          // Optional but recommended
  }) {
    if (!idempotencyKey) throw new Error('Idempotency key required');
    if (!returnUrl) throw new Error('returnUrl required for 3DS');
    if (!bookingId) throw new Error('bookingId required for audit trail');
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error('Amount must be positive integer in minor units');
    }
    if (currency.toLowerCase() === 'ngn') {
      throw new Error('Stripe does not support NGN. Use Paystack.');
    }

    const payload = {
      amount: amountInCents,
      currency: currency.toLowerCase().trim(),
      payment_method: paymentMethodId,
      customer: customerId || undefined,
      confirm: true,
      description: `Conference booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        user_id: userId || 'guest',
        env: process.env.NODE_ENV,
      },
      automatic_payment_methods: { enabled: true, allow_redirects: 'always' },
      return_url: returnUrl,
    };

    if (offSession) {
      payload.off_session = true;
    }

    try {
      const pi = await this.stripe.paymentIntents.create(payload, { idempotencyKey });

      switch (pi.status) {
        case 'succeeded':
          return { success: true, transactionId: pi.id, status: 'succeeded' };
        
        case 'requires_action':
          return {
            success: false,
            status: 'requires_action',
            clientSecret: pi.client_secret,
            errorMessage: 'Authentication required by bank.'
          };
        
        case 'requires_payment_method':
          return {
            success: false,
            status: 'requires_payment_method',
            code: pi.last_payment_error?.code,
            errorMessage: pi.last_payment_error?.message || 'Payment failed. Try another card.'
          };
        
        case 'processing':
          return { success: true, status: 'processing', transactionId: pi.id }; // ACH/cards take time
        
        default:
          return { success: false, status: pi.status, errorMessage: `Unhandled status: ${pi.status}` };
      }

    } catch (error) {
      if (error instanceof Stripe.errors.StripeCardError) {
        return { success: false, status: 'declined', code: error.code, errorMessage: error.message };
      }
      if (error instanceof Stripe.errors.StripeIdempotencyError) {
        this.logger.error({ key: idempotencyKey, err: error }, 'Idempotency key reused with different params');
        return { success: false, status: 'error', errorMessage: 'Duplicate request detected.' };
      }
      this.logger.error({ err: error, idempotencyKey, bookingId }, 'Stripe gateway error');
      return { success: false, status: 'error', errorMessage: 'Payment processing failed. Please try again.' };
    }
  }
}

