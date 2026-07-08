// messaging/KafkaProducer.js
import { CompressionTypes } from "kafkajs";

export class KafkaProducer {
  constructor(kafka, config) { // UPGRADE: Accept injected kafka + config
    this.producer = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1, // UPGRADE: Explicit for idempotence guarantee
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
     ...config,
    });
    this.isInitialized = false;
    this.isReconnecting = false;
    this.reconnectTimeoutRef = null;

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleCrash = this.handleCrash.bind(this);
  }

  async connect() {
    if (this.isInitialized) return;
    try {
      console.log("[KafkaProducer] Initializing connection to cluster brokers...");
      await this.producer.connect();
      this.isInitialized = true;
      this.isReconnecting = false;
      console.log("[KafkaProducer] Connection established and stabilized successfully.");
      this.registerInstrumentationEvents();
    } catch (error) {
      console.error("[KafkaProducer] Fatal initialization collapse:", error.message);
      throw error;
    }
  }

  registerInstrumentationEvents() {
    this.producer.off(this.producer.events.DISCONNECT, this.handleDisconnect);
    this.producer.off(this.producer.events.CRASH, this.handleCrash);
    this.producer.on(this.producer.events.DISCONNECT, this.handleDisconnect);
    this.producer.on(this.producer.events.CRASH, this.handleCrash);
  }

  handleDisconnect() {
    console.warn("[KafkaProducer] WARNING: Internal network disconnect detected. KafkaJS is attempting self-healing recovery...");
  }

  async handleCrash(event) {
    console.error("[KafkaProducer] FATAL: Internal driver crash detected:", event.payload.error?.message || event.payload.error);
    this.isInitialized = false;
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    console.log("[KafkaProducer] Initiating hot-reload recovery sequence...");
    try {
      await this.producer.disconnect();
    } catch (disconnectError) {}
    if (this.reconnectTimeoutRef) clearTimeout(this.reconnectTimeoutRef);
    this.reconnectTimeoutRef = setTimeout(async () => {
      try {
        await this.connect();
      } catch (reconnectError) {
        console.error("[KafkaProducer] Self-healing cycle failed:", reconnectError.message);
        this.isReconnecting = false;
      }
    }, 5000);
  }

  async send(topic, payload, messageKey) {
    if (!this.isInitialized) {
      throw new Error("KafkaProducer Exception: Producer not initialized. Run connect() first.");
    }
    if (!topic) {
      throw new Error("Topic is required.");
    }
    if (payload === undefined) {
      throw new Error("Payload is required.");
    }
    await this.producer.send({
      topic: topic,
      compression: CompressionTypes.GZIP,
      messages: [{
        key: messageKey != null? String(messageKey) : undefined,
        value: typeof payload === "string"? payload : JSON.stringify(payload),
        headers: {
            traceId:
                messageKey != null
                  ? String(messageKey)
                  : undefined,
            producedAt: new Date().toISOString(),
       }
      }],
    });
  }

  async disconnect() {
    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef);
      this.reconnectTimeoutRef = null;
    }
    this.isReconnecting = false;
    if (!this.isInitialized) return;
    try {
      console.log("[KafkaProducer] Draining internal memory pipelines...");
      await this.producer.disconnect();
      this.isInitialized = false;
      console.log("[KafkaProducer] Broker socket lines detached cleanly.");
    } catch (error) {
      console.error("[KafkaProducer] Error during disconnection:", error);
    }
  }
}