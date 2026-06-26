import { z } from 'zod';

/**
 * Tool definition for rescheduling an existing conference event/talk.
 * Handles time changes, room changes, or both. Runs conflict checks atomically.
 * Requires organizer/admin role on the parent conference.
 */
export const rescheduleEventToolDef = {
  name: 'reschedule_event',
  description: `Change the start_time, end_time, and/or room_id of an existing conference event.
  Use when user says "move the keynote to 3pm", "shift Room A talks 30min later", "swap rooms".
  Validates no scheduling conflicts before committing. Emits EventRescheduled to outbox.
  Cannot reschedule events that already started.`,

  zodSchema: z.object({
    conference_id: z.string().uuid()
      .describe('Required. Parent conference UUID for authz scoping.'),
    
    event_id: z.string().uuid()
      .describe('Required. Event UUID to reschedule.'),
    
    // At least one field to change
    start_time: z.string()
      .datetime({ offset: false, message: 'Must be UTC with Z suffix' })
      .optional()
      .describe('New UTC start time. Must be in future. If provided, end_time must also be provided.'),
    
    end_time: z.string()
      .datetime({ offset: false, message: 'Must be UTC with Z suffix' })
      .optional()
      .describe('New UTC end time. Must be after start_time.'),
    
    room_id: z.string().uuid().nullable().optional()
      .describe('New room UUID. Set to null to unassign from room. Omit to keep current room.'),
    
    reason: z.string()
      .trim()
      .min(5, 'Reason too short')
      .max(500)
      .optional()
      .describe('Optional reason for audit log: "speaker flight delay", "room A/V issue".'),
    
    idempotency_key: z.string().uuid()
      .describe('Required. UUID to prevent duplicate reschedules on retry.')
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasTimeChange = data.start_time || data.end_time;
    const hasRoomChange = data.room_id !== undefined;
    
    // 1. Must change something
    if (!hasTimeChange && !hasRoomChange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must provide start_time/end_time or room_id to change',
        path: ['start_time']
      });
    }
    
    // 2. If changing time, both start+end required
    if (data.start_time && !data.end_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_time required when changing start_time',
        path: ['end_time']
      });
    }
    if (data.end_time && !data.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start_time required when changing end_time',
        path: ['start_time']
      });
    }
    
    // 3. Time validation if present
    if (data.start_time && data.end_time) {
      const start = new Date(data.start_time);
      const end = new Date(data.end_time);
      const now = new Date();
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid ISO 8601 datetime',
          path: ['start_time']
        });
        return;
      }
      if (start <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'New start_time must be in the future',
          path: ['start_time']
        });
      }
      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'end_time must be after start_time',
          path: ['end_time']
        });
      }
      
      // Max duration check
      const durationMs = end.getTime() - start.getTime();
      if (durationMs > 12 * 60 * 60 * 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Event cannot be longer than 12 hours',
          path: ['end_time']
        });
      }
    }
  }),

  // Operational Metadata
  requiresRole: ['organizer', 'admin'], // Attendees cannot reschedule
  featureFlag: 'llm_reschedule_event_enabled',
  costCents: 5, // Write + conflict check + outbox + notifications
  slaMs: 2000,  // DB transaction + row locks
  useCase: 'rescheduleEvent',
  rateLimit: {
    perUserPerMin: 10, // Prevent spam reschedules
    perEventPerMin: 3  // Prevent race conditions on same event
  },
  
  responseContract: {
    type: 'object',
    properties: {
      event_id: { type: 'string' },
      old_start_time: { type: 'string' },
      new_start_time: { type: 'string' },
      old_room_id: { type: 'string | null' },
      new_room_id: { type: 'string | null' },
      conflict_warnings: { type: 'string[]' } // e.g. "Speaker now has 10min gap"
    }
  }
} as const;

export type RescheduleEventInput = z.infer<typeof rescheduleEventToolDef.zodSchema>;
