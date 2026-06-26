import { z } from 'zod';

export const listEventToolDef = {
  name: 'list_event',
  description: `List conference events/talks with filters. Returns paginated results.
  Use for "what's on today", "show engineering track", "talks in Room A".
  Results ordered by start_time ascending. For single known event use get_event.`,

  zodSchema: z.object({
    conference_id: z.string().uuid()
     .describe('Required. Conference UUID to list from.'),
    
    track: z.enum(['engineering', 'product', 'design', 'keynote']).optional(),
    room_id: z.string().uuid().optional(),
    
    date: z.string()
     .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM-DD')
     .optional()
     .describe('Date in conference local timezone, e.g. 2026-06-27'),
    
    search: z.string()
     .trim()
     .toLowerCase() // index friendly
     .min(2)
     .max(50)
     .transform(s => s.replace(/[%_\\]/g, ''))
     .transform(s => s.replace(/[^\w\s\-:]/g, ''))
     .optional()
     .describe('Keyword search in title/speaker. Min 2 chars.'),
    
    // Removed only_public - set in useCase based on role
    
    limit: z.number().int().min(1).max(50).default(20)
     .describe('Results per page. Default 20.'),
    
    cursor: z.string().optional()
     .describe('Pagination cursor from previous response.next_cursor')
  })
 .strict()
 .superRefine((data, ctx) => {
    if (data.date && isNaN(new Date(data.date + 'T00:00:00Z').getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date', path: ['date'] });
    }
  }),

  requiresRole: ['attendee', 'organizer', 'admin'],
  featureFlag: 'llm_list_event_enabled',
  costCents: 2,
  slaMs: 500,
  useCase: 'listEvent',
  rateLimit: { perUserPerMin: 20 }, // List is expensive
  
  responseContract: {
    type: 'object',
    properties: {
      events: { type: 'EventSummary[]', maxItems: 50 },
      next_cursor: { type: 'string | null' },
      total_estimate: { type: 'number' } // optional for "showing 20 of 200"
    }
  }
} as const;

export type ListEventInput = z.infer<typeof listEventToolDef.zodSchema>;
