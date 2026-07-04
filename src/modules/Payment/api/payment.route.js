// src/modules/Payment/api/payment.route.js

import { authGuard } from '../../../shared/middleware/authGuard.js';
import { validate } from '../../../shared/middleware/validate.js';
import { webhookRawBody } from '../../../shared/middleware/webhookRawBody.js';
import { rateLimit } from '../../../shared/middleware/rateLimit.js';
import { ipAllowlist } from '../../../shared/middleware/ipAllowlist.js';
import { idempotency } from '../../../shared/middleware/idempotency.js';
import { 
  createPaymentSchema,
  refundPaymentSchema,
  getPaymentByIdSchema 
} from './validators/payment.schema.js';

/**
 * Hardened Webhook IP Allowlists
 * Source: Official provider documentation for live networks.
 * 
 * NOTE: For enterprise production, look up these IPs dynamically 
 * or pull them from environment variables via configuration providers.
 */
const STRIPE_IPS = [
  '3.18.12.63/32', '3.130.192.231/32', '54.187.174.169/32', 
  '54.187.205.235/32', '54.187.216.72/32'
];

const PAYSTACK_IPS = [
  '52.31.139.75/32', '52.49.173.169/32', '52.214.14.220/32'
];

export const getPaymentRoutes = (paymentController, paymentWebhookController) => [
  {
    method: 'post',
    path: '/payments',
    middleware: [
      // Hardened keyGenerator warning & added user scoping for authenticated context
      rateLimit({ 
        max: 10, 
        windowMs: 60000,
        keyGenerator: (req) => req.user?.id || req.ip
      }),
      authGuard(),
      validate(createPaymentSchema),
      idempotency()
    ],
    handler: (req, res, next) => paymentController.createPayment(req, res, next)
  },
  {
    method: 'get',
    path: '/payments/:id',
    middleware: [
      validate(getPaymentByIdSchema), // Fast fail regex check BEFORE hitting memory/rate-limiter
      rateLimit({ max: 100, windowMs: 60000 }), 
      authGuard()
    ],
    handler: (req, res, next) => paymentController.getPaymentById(req, res, next)
  },
  {
    method: 'get',
    path: '/payments',
    middleware: [
      rateLimit({ max: 20, windowMs: 60000 }), 
      authGuard('admin')
    ],
    handler: (req, res, next) => paymentController.getAllPayments(req, res, next)
  },
  {
    method: 'post',
    path: '/payments/:id/refund',
    middleware: [
      validate(refundPaymentSchema), // Validation runs first to block trash inputs early
      rateLimit({ max: 5, windowMs: 60000 }), 
      authGuard('admin'),
      idempotency()
    ],
    handler: (req, res, next) => paymentController.refundPayment(req, res, next)
  },
  {
    method: 'post',
    path: '/webhooks/paystack',
    middleware: [
      // Webhook protection must NOT use standard global IP limiters (risk of provider DDOS blocking)
      ipAllowlist(PAYSTACK_IPS), 
      webhookRawBody() // Generates raw text body required for reliable HMAC crypto verification
    ],
    handler: (req, res, next) => paymentWebhookController.handlePaystackWebhook(req, res, next)
  },
  {
    method: 'post',
    path: '/webhooks/stripe',
    middleware: [
      ipAllowlist(STRIPE_IPS), 
      webhookRawBody()
    ],
    handler: (req, res, next) => paymentWebhookController.handleStripeWebhook(req, res, next)
  }
];