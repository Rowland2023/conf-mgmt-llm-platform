import { z } from 'zod';

/**
 * ToolRegistry: Single source of truth for all LLM-callable functions.
 * 
 * Why a registry vs hardcoding:
 * 1. OpenAI needs tool definitions. ToolExecutor needs Zod schemas + handlers.
 * 2. Registry ensures both use identical names/params. No drift.
 * 3. Enables runtime introspection: /admin/tools endpoint can list capabilities.
 * 4. Enables feature flags: disable a tool without redeploy.
 */
export class ToolRegistry {
  constructor({ featureFlags = {}, domainServices }) {
    this.domain = domainServices;
    this.flags = featureFlags;
    this._tools = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register({
      name: 'reschedule_slot',
      description: 'Reschedule a conference talk to a new time. Validates capacity and speaker conflicts.',
      zodSchema: z.object({
        conference_id: z.string().uuid().describe('Conference UUID'),
        slot_id: z.string().uuid().describe('Talk/Slot UUID to move'),
        new_start_time: z.string().datetime().describe('ISO 8601 UTC start time'),
        notify_speakers: z.boolean().default(true).describe('Send email to speakers')
      }).strict(),
      handler: this.domain.conference.rescheduleSlot.bind(this.domain.conference),
      requiresRole: ['organizer', 'admin'],
      featureFlag: 'llm_reschedule_enabled',
      costCents: 2, // For FinOps: avg cost per call
      slaMs: 150,   // Expected p99 for alerting
    });

    this.register({
      name: 'enrich_speaker_bio',
      description: 'Generate a 2-sentence professional bio from LinkedIn URL. Only for new speakers.',
      zodSchema: z.object({
        speaker_id: z.string().uuid(),
        linkedin_url: z.string().url().refine(
          (url) => url.includes('linkedin.com/in/'),
          'Must be a LinkedIn profile URL'
        )
      }).strict(),
      handler: this.domain.speaker.enrichBio.bind(this.domain.speaker),
      requiresRole: ['organizer', 'admin'],
      featureFlag: 'llm_bio_enrichment_enabled',
      costCents: 5,
      slaMs: 800,
    });

    this.register({
      name: 'cancel_booking',
      description: 'Cancel a ticket booking and trigger refund workflow if applicable.',
      zodSchema: z.object({
        booking_id: z.string().uuid(),
        reason: z.string().min(10).max(500),
        refund: z.boolean().default(false)
      }).strict(),
      handler: this.domain.booking.cancel.bind(this.domain.booking),
      requiresRole: ['support', 'admin'],
      featureFlag: 'llm_cancel_enabled',
      costCents: 1,
      slaMs: 100,
    });

    this.register({
      name: 'draft_welcome_email',
      description: 'Queue a personalized welcome email for a new attendee. Does not send immediately.',
      zodSchema: z.object({
        booking_id: z.string().uuid()
      }).strict(),
      handler: this.domain.communication.queueWelcome.bind(this.domain.communication),
      requiresRole: ['organizer', 'admin'],
      featureFlag: 'llm_email_enabled',
      costCents: 3,
      slaMs: 50,
    });
  }

  register(definition) {
    if (this._tools.has(definition.name)) {
      throw new Error(`TOOL_DUPLICATE: ${definition.name} already registered`);
    }

    // Validate definition at startup. Fail fast.
    const required = ['name', 'description', 'zodSchema', 'handler'];
    for (const field of required) {
      if (!definition[field]) throw new Error(`TOOL_INVALID: ${definition.name} missing ${field}`);
    }

    this._tools.set(definition.name, {
      ...definition,
      enabled: this.flags[definition.featureFlag] !== false, // Default enabled
    });
  }

  /**
   * For OpenAIClient: Get tool definitions in OpenAI format
   * Filters by role + feature flag
   */
  getOpenAITools(userRoles = []) {
    const tools = [];
    for (const [name, def] of this._tools) {
      if (!def.enabled) continue;
      if (def.requiresRole && !def.requiresRole.some(r => userRoles.includes(r))) continue;

      tools.push({
        type: 'function',
        function: {
          name: def.name,
          description: def.description,
          parameters: this.zodToJsonSchema(def.zodSchema)
        }
      });
    }
    return tools;
  }

  /**
   * For ToolExecutor: Get Zod schemas keyed by tool name
   */
  getZodSchemas() {
    const schemas = {};
    for (const [name, def] of this._tools) {
      if (def.enabled) schemas[name] = def.zodSchema;
    }
    return schemas;
  }

  /**
   * For ToolExecutor: Get handler function
   */
  getHandler(name) {
    const def = this._tools.get(name);
    if (!def || !def.enabled) return null;
    return def.handler;
  }

  /**
   * For observability/cost tracking
   */
  getMetadata(name) {
    const def = this._tools.get(name);
    return def ? { costCents: def.costCents, slaMs: def.slaMs } : null;
  }

  /**
   * For /admin/tools endpoint
   */
  listAll() {
    return Array.from(this._tools.values()).map(def => ({
      name: def.name,
      description: def.description,
      enabled: def.enabled,
      requiresRole: def.requiresRole,
      costCents: def.costCents
    }));
  }

  /**
   * Convert Zod to JSON Schema for OpenAI
   * Use zod-to-json-schema in prod, simplified here
   */
  zodToJsonSchema(schema) {
    // In production: return zodToJsonSchema(schema, 'openai');
    // Simplified for example:
    const shape = schema._def.shape();
    const properties = {};
    const required = [];
    
    for (const [key, val] of Object.entries(shape)) {
      properties[key] = { type: 'string' }; // Simplified
      if (!val.isOptional()) required.push(key);
      if (val.description) properties[key].description = val.description;
    }
    
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false // Critical: stops LLM from adding fields
    };
  }
}