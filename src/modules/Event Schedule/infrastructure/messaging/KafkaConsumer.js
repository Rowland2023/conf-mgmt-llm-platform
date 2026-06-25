// messaging/KafkaConsumer.js
import { Kafka } from "kafkajs";

export class KafkaConsumer {
  /**
   * @param {Kafka} kafka - Shared Kafka instance from index.js
   * @param {object} config - consumerConfig from config.js
   * @param {object} handlerMap - { 'orders.order_created.v1': handlerFn }
   */
  constructor(kafka, config, handlerMap) {
    if (!kafka || !config?.groupId || !handlerMap) {
      throw new Error("KafkaConsumer Invariant Violation: Missing kafka, config.groupId, or handlerMap.");
    }

    this.consumer = kafka.consumer({ 
      groupId: config.groupId,
      maxBytesPerPartition: config.maxBytesPerPartition || 1024 * 1024 * 2,
      sessionTimeout: config.sessionTimeout,
      heartbeatInterval: config.heartbeatInterval,
      allowAutoTopicCreation: false,
    });

    this.handlerMap = handlerMap;
    this.topics = Object.keys(handlerMap); // UPGRADE: Derive topics from handlerMap
    this.isInitialized = false;
    this.isReconnecting = false;

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleCrash = this.handleCrash.bind(this);
  }

  async start() {
    if (this.isInitialized) return;

    try {
      console.log(`[KafkaConsumer] Attaching to cluster group: ${this.consumer.groupId}...`);
      await this.consumer.connect();
      this.isInitialized = true;
      this.isReconnecting = false;

      this.registerInstrumentationEvents();

      await Promise.all(
        this.topics.map(topic => this.consumer.subscribe({ topic, fromBeginning: false }))
      );

      await this.consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          const topic = batch.topic;
          const partition = batch.partition;
          const handler = this.handlerMap[topic];

          if (!handler) {
            console.error(`[KafkaConsumer] No handler registered for topic ${topic}`);
            return;
          }

          for (const message of batch.messages) {
            if (!isRunning() || isStale()) {
              console.warn(`[KafkaConsumer] Batch partition ownership is stale. Halting loop.`);
              break;
            }

            const success = await this.handleMessageExecution({ topic, partition, message, handler });
            
            if (success) {
              resolveOffset(message.offset);
            } else {
              // CRITICAL: Stop batch on DLQ failure to prevent data loss
              throw new Error(`[KafkaConsumer] Critical processing block at offset ${message.offset}. Halting batch.`);
            }

            await heartbeat();
          }
        }
      });

      console.log("[KafkaConsumer] Cluster subscription pipelines are live and listening.");
    } catch (error) {
      console.error("[KafkaConsumer] Fatal instantiation crash:", error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  async handleMessageExecution({ topic, partition, message, handler }) {
    const messageId = message.key ? message.key.toString() : `${topic}-${partition}-${message.offset}`;
    const traceId = message.headers?.traceId?.toString() || messageId;
    
    try {
      const rawValue = message.value ? message.value.toString() : null;
      const payload = rawValue && (rawValue.startsWith('{') || rawValue.startsWith('[')) 
        ? JSON.parse(rawValue) 
        : rawValue;

      const eventContext = {
        id: messageId,
        traceId,
        topic,
        partition,
        offset: message.offset,
        timestamp: message.timestamp,
        eventType: message.headers?.eventType?.toString() || topic,
        payload
      };

      // UPGRADE: Handler should be idempotent itself, or wrap it here with DB check
      await handler(eventContext);
      return true;

    } catch (error) {
      console.error(
        `[KafkaConsumer] [CRITICAL FAILURE] topic: ${topic}, offset: ${message.offset}, key: ${messageId}, error:`, 
        error.message
      );
      
      try {
        await this.routeToDeadLetterQueue(topic, message, error);
        return true; 
      } catch (dlqError) {
        console.error("[KafkaConsumer] FATAL: DLQ write failed. Halting offset updates:", dlqError.message);
        return false; 
      }
    }
  }

  async routeToDeadLetterQueue(originTopic, brokenMessage, processingError) {
    // TODO: Implement actual DLQ publish using producer
    // For now, just log. In prod, send to `${originTopic}.dlq.v1`
    console.warn(`[KafkaConsumer] DLQ: ${originTopic}-dlq`, {
      key: brokenMessage.key?.toString(),
      error: processingError.message,
    });
  }

  registerInstrumentationEvents() {
    this.consumer.off(this.consumer.events.DISCONNECT, this.handleDisconnect);
    this.consumer.off(this.consumer.events.CRASH, this.handleCrash);
    this.consumer.on(this.consumer.events.DISCONNECT, this.handleDisconnect);
    this.consumer.on(this.consumer.events.CRASH, this.handleCrash);
  }

  handleDisconnect() {
    console.warn("[KafkaConsumer] WARNING: Broker connection dropped. Auto-rebalancing...");
  }

  async handleCrash(event) {
    console.error("[KafkaConsumer] FATAL: Group crash:", event.payload.error?.message || event.payload.error);
    this.isInitialized = false;
  }

  async healthCheck() {
    return this.isInitialized && !this.isReconnecting;
  }

  async stop() {
    if (!this.isInitialized) return;
    try {
      console.log("[KafkaConsumer] Signaling intent to depart consumer group cleanly...");
      await this.consumer.disconnect();
      this.isInitialized = false;
      console.log("[KafkaConsumer] Consumer pipeline safely disconnected.");
    } catch (error) {
      console.error("[KafkaConsumer] Error during teardown:", error);
    }
  }
}