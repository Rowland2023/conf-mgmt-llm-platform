// messaging/config.js
export const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID || 'payments-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_USERNAME? {
    mechanism: 'plain', // or 'scram-sha-256'
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
  connectionTimeout: 3000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
};

export const producerConfig = {
  allowAutoTopicCreation: false,
  transactionTimeout: 30000,
  idempotent: true, // Critical: enables exactly-once semantics on Kafka side
  maxInFlightRequests: 1, // Required for idempotence
};

export const consumerConfig = {
  groupId: process.env.KAFKA_CONSUMER_GROUP || 'payments-service-worker',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxBytesPerPartition: 1048576, // 1MB
  allowAutoTopicCreation: false,
};

export const outboxConfig = {
  pollIntervalMs: parseInt(process.env.OUTBOX_POLL_MS || '1000', 10),
  batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '100', 10),
};