import Joi from 'joi';

const uuidSchema = Joi.string().guid({ version: 'uuidv4' });

const currencySchema = Joi.string()
  .uppercase()
  .valid('NGN', 'USD', 'GHS', 'KES', 'ZAR')
  .required()
  .messages({ 'any.only': 'Currency must be one of: NGN, USD, GHS, KES, ZAR' });

/**
 * FIXED: Currency-neutral threshold framing.
 * Hardcoded currency symbols have been removed from the validation messages. 
 * Instead, we use Joi's dynamic template tags to cleanly print raw values.
 */
const integerAmountSchema = Joi.number()
  .integer()
  .min(100) 
  .max(1000000000) 
  .required()
  .messages({
    'number.base': 'Amount must be a numeric primitive value.',
    'number.integer': 'Amount must be an integer represented in its base minor subunit (e.g., cents/kobo).',
    'number.min': 'The minimum allowed transaction volume is {#limit} minor subunits.',
    'number.max': 'The transaction volume exceeds the maximum structural ceiling limit of {#limit} minor subunits.'
  });

const idempotencyKeySchema = Joi.string()
  .trim()
  .min(16)
  .max(255)
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Idempotency key structure must be alphanumeric (allowing only letters, numbers, hyphens, and underscores).',
    'string.min': 'Idempotency validation security strings must be at least {#limit} characters long.'
  });

const orderIdSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9_-]{8,64}$/)
  .required()
  .messages({ 'string.pattern.base': 'OrderId must be between 8 and 64 characters and contain only alphanumeric tokens, hyphens, or underscores.' });

/**
 * 1. POST /payments Schema
 */
export const createPaymentSchema = Joi.object({
  body: Joi.object({
    orderId: orderIdSchema,
    amount: integerAmountSchema,
    currency: currencySchema,
    gateway: Joi.string().valid('stripe', 'paystack').required()
  }).required(),
  
  // FIXED: Marked the headers block itself as .required() to close the idempotency bypass hole
  headers: Joi.object({
    'x-idempotency-key': idempotencyKeySchema
  }).unknown(true).required()
});

/**
 * 2. GET /payments/:id Schema
 */
export const getPaymentByIdSchema = Joi.object({
  params: Joi.object({
    id: uuidSchema.required().messages({
      'string.guid': 'The payment lookup route parameter must match a valid UUIDv4 structure.'
    })
  }).required()
});

/**
 * 3. POST /payments/:id/refund Schema
 */
export const refundPaymentSchema = Joi.object({
  params: Joi.object({
    id: uuidSchema.required()
  }).required(),
  
  body: Joi.object({
    amount: integerAmountSchema,
    reason: Joi.string().trim().max(500).default('Customer requested refund')
  }).required(),
  
  // FIXED: Marked headers as required to enforce idempotency keys on refunds
  headers: Joi.object({
    'x-idempotency-key': idempotencyKeySchema
  }).unknown(true).required()
});