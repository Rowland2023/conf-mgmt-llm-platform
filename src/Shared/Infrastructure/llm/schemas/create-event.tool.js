import { z } from 'zod';

export const createEventToolDef = {
  name: 'create_event',
  description: `Create a new conference event or talk. 
Requires organizer or admin role. 
Start and end times must be in the future and in UTC ISO 8601 format.
If room_id is omitted, the event is created as unassigned.`,
  
  zodSchema: z.object({
    conference_id: z.string().uuid().describe('Parent conference UUID'),
    title: z.string()
      .min(3, 'Title too short')
      .max(200, 'Title too long')
      .describe('Event or talk title'),
    description: z.string()
      .max(2000)
      .optional()
      .describe('Markdown description, agenda, or abstract'),
    start_time: z.string()
      .datetime({ offset: true })
      .describe('UTC start time in ISO 8601 format (e.g., 2026-06-27T15:00:00Z)'),
    end_time: z.string()
      .datetime({ offset: true })
      .describe('UTC end time in ISO 8601 format (e.g., 2026-06-27T16:00:00Z)'),
    room_id: z.string()
      .uuid()
      .optional()
      .describe('Room UUID to pre-assign. Omit to leave unassigned'),
    track: z.enum(['engineering', 'product', 'design', 'keynote'])
      .optional()
      .describe('Conference track for scheduling'),
    is_public: z.boolean()
      .default(true)
      .describe('Show on public agenda')
  })
  .strict()
  .refine(
    data => new Date(data.end_time) > new Date(data.start_time),
    { message: 'end_time must be after start_time', path: ['end_time'] }
  ),

  // Operational Metadata Map (Used by core routing middleware & telemetry)
  requiresRole: ['organizer', 'admin'],
  featureFlag: 'llm_create_event_enabled',
  costCents: 3, 
  slaMs: 250,   
  useCase: 'createEvent' 
};