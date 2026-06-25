// infrastructure/observability/tracing.js
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

const traceContextStorage = new AsyncLocalStorage();

export const Tracing = {
  /**
   * Wraps an execution loop block within a distinct tracking context boundary
   * @param {string|null|undefined} incomingTraceId - Optional traceId from upstream components
   * @param {Function} callback - Code block execution perimeter
   */
  runWithContext(incomingTraceId, callback) {
    const traceId = incomingTraceId || `tr_${randomUUID()}`;
    
    // MICRO-OPTIMIZATION: Object.create(null) allocates significantly less memory 
    // than a standard Map or literal {}, bypasses prototype pollution vulnerabilities,
    // and eliminates garbage collection (GC) pressure under heavy event loop load.
    const store = Object.create(null);
    store.traceId = traceId;
    store.startTime = Date.now();

    return traceContextStorage.run(store, callback);
  },

  /**
   * Retrieves the current tracking ID identifier safely within any execution layer
   * @returns {string|undefined}
   */
  getTraceId() {
    const store = traceContextStorage.getStore();
    return store ? store.traceId : undefined;
  },

  /**
   * Generates a context metadata object combining trace identifiers for structural injection
   * @returns {object}
   */
  getTraceMetadata() {
    const store = traceContextStorage.getStore();
    if (!store) return Object.create(null);

    // Fast property access bypassing Map.get() method signature invocation steps
    return {
      traceId: store.traceId,
      elapsedMs: Date.now() - store.startTime,
    };
  },

  /**
   * OPTIONAL EXPANSION: Safely appends runtime attributes to the active trace context
   * Useful for capturing user context, partition boundaries, or operation states.
   * @param {string} key 
   * @param {any} value
   */
  setAttribute(key, value) {
    const store = traceContextStorage.getStore();
    if (store) {
      store[key] = value;
    }
  },

  /**
   * OPTIONAL EXPANSION: Dynamically fetches any custom attribute out of context storage
   * @param {string} key
   * @returns {any}
   */
  getAttribute(key) {
    const store = traceContextStorage.getStore();
    return store ? store[key] : undefined;
  }
};