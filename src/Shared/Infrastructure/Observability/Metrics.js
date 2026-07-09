import client from "prom-client";

// Guard against double-initialization in testing environments or serverless contexts
const registry = client.register;

// Collect standard Node.js runtime process metrics automatically (CPU, Memory, Event Loop Lag)
client.collectDefaultMetrics({ 
  register: registry, 
  prefix: "app_" 
});

/**
   Helper to fetch or register metrics cleanly, preventing double-registration crashes.
 */
function getOrCreateCounter(config) {
  return registry.getSingleMetric(config.name) || new client.Counter(config);
}

function getOrCreateHistogram(config) {
  return registry.getSingleMetric(config.name) || new client.Histogram(config);
}

function getOrCreateGauge(config) {
  return registry.getSingleMetric(config.name) || new client.Gauge(config);
}

export const Metrics = {
  registry,

  // 1. Tracks running volumetric occurrences (e.g., Total events dispatched)
  outboxEventsPublished: getOrCreateCounter({
    name: "outbox_events_published_total",
    help: "Total count of integration events dispatched to Kafka broker",
    labelNames: ["topic", "status"], // Safe, low-cardinality labels
  }),

  // 2. Tracks duration distribution (e.g., DB performance execution speeds)
  databaseQueryDuration: getOrCreateHistogram({
    name: "db_query_duration_seconds",
    help: "Time spent executing database transactions inside repository boundaries",
    labelNames: ["operation", "status"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0], // Excellent millisecond scaling
  }),

  // 3. Tracks point-in-time contextual levels (e.g., current outbox backlog depth)
  outboxLagGauge: getOrCreateGauge({
    name: "outbox_pending_messages_count",
    help: "Current number of unprocessed items sitting in the outbox table partition",
  }),
  
  // UPGRADE: Added Consumer Processing Latency tracking capability
  consumerProcessingDuration: getOrCreateHistogram({
    name: "kafka_consumer_processing_duration_seconds",
    help: "Time spent by the domain use-case processor handling a message",
    labelNames: ["topic", "status"],
    buckets: [0.005, 0.02, 0.1, 0.5, 1.0, 3.0, 10.0], // Tailored for heavier business processing tasks
  }),
};