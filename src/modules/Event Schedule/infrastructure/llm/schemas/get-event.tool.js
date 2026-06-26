import { z } from 'zod';

/**
 * Tool definition for retrieving event details.
 * Optimized for LLM gateway: single lookup path, built-in limits, safe search.
 */
export const getEventToolDef = {
  name: 'get_event',
  description: `Retrieve details for a specific conference event or talk.
  Use event_id when the UUID is known from context. 
  Use search_query for title, speaker, or topic lookup.
  Returns full event details if 1 match, or a disambiguation list if multiple matches.
  Always scope to conferences the user can access.`,

  zodSchema: z.object({
    // Optional scope - if omitted, search all conferences user has access to
    conference_id: z.string().uuid().optional()
      .describe('Scope search to a specific conference UUID. Omit to search all accessible conferences.'),
    
    // Hard limit prevents token/context explosion
    limit: z.number().int()
      .min(1)
      .max(10)
      .default(3)
      .describe('Maximum events to return for search queries. Default 3.')
  })
  .and(
    // XOR: exactly one of event_id or search_query must be present
    z.union([
      z.object({
        event_id: z.string().uuid()
          .describe('Exact Event UUID from previous context or tool calls.')
      }),
      z.object({
        search_query: z.string()
          .trim()
          .min(2, 'Search term too short')
          .max(100, 'Search term too long')
          // Strip SQL wildcards and control chars before DB
          .transform(s => s.replace(/[%_\\]/g, '')) // Remove LIKE wildcards
          .transform(s => s.replace(/[^\w\s\-:]/g, '')) // Keep only safe chars
          .describe('Title keywords, speaker name, or topic. Min 2 chars.')
      })
    ])
  )
  .strict(),

  // Operational Metadata Map
  requiresRole: ['attendee', 'organizer', 'admin'],
  featureFlag: 'llm_get_event_enabled',
  costCents: 1, // Read path
  slaMs: 300,   // Search requires index scan, 100ms unrealistic
  useCase: 'getEvent',
  rateLimit: { 
    perUserPerMin: 30,
    perIpPerMin: 100 
  },
  
  // Contract for LLM: what to expect back
  responseContract: {
    type: 'oneOf',
    variants: [
      { type: 'event', schema: 'EventDetail' },
      { type: 'disambiguation', schema: 'EventOption[]' },
      { type: 'not_found', schema: 'null' }
    ]
  }
} as const;

// Type inference for your handler
export type GetEventInput = z.infer<typeof getEventToolDef.zodSchema>;