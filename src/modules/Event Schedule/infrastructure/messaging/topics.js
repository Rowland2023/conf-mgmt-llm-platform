// messaging/topics.js
export const Topics = {
  // Order domain
  ORDER_CREATED: 'orders.order_created.v1',
  ORDER_CANCELLED: 'orders.order_cancelled.v1',
  ORDER_SETTLED: 'orders.order_settled.v1',

  // Payment domain
  PAYMENT_INITIATED: 'payments.initiated.v1',
  PAYMENT_SUCCEEDED: 'payments.succeeded.v1',
  PAYMENT_FAILED: 'payments.failed.v1',

  // User/KYC domain
  USER_KYC_APPROVED: 'users.kyc_approved.v1',
  USER_KYC_REJECTED: 'users.kyc_rejected.v1',

  // Webhook domain
  WEBHOOK_RECEIVED: 'webhooks.received.v1',
};

// Helper to validate topic exists
export function isValidTopic(topic) {
  return Object.values(Topics).includes(topic);
}