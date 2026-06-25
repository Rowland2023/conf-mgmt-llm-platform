// messaging/index.js
import { Kafka } from 'kafkajs';
import { kafkaConfig, producerConfig, consumerConfig, outboxConfig } from './config.js';
import { KafkaProducer } from './KafkaProducer.js';
import { KafkaConsumer } from './KafkaConsumer.js';
import { OutboxPublisher } from './OutboxPublisher.js';
import { Topics } from './topics.js';

// 1. Create singleton Kafka client
const kafka = new Kafka(kafkaConfig);

// 2. Create producer - shared by OutboxPublisher and any direct publishers
const producer = new KafkaProducer(kafka, producerConfig);

// 3. Create consumer - needs handler map injected from outside
export function createConsumer(handlerMap) {
  return new KafkaConsumer(kafka, consumerConfig, handlerMap);
}

// 4. Create outbox publisher - needs db + producer injected
export function createOutboxPublisher(db) {
  return new OutboxPublisher({
    db,
    kafkaProducer: producer,
    pollIntervalMs: outboxConfig.pollIntervalMs,
    batchSize: outboxConfig.batchSize,
  });
}

// 5. Export singletons and factories
export { producer, Topics };

// 6. Helper to connect/disconnect everything at once
export async function connect() {
  await producer.connect();
  console.log('[Messaging] Kafka producer connected');
}

export async function disconnect() {
  await producer.disconnect();
  console.log('[Messaging] Kafka producer disconnected');
}