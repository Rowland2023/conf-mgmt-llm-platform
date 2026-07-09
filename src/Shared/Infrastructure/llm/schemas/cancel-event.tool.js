// infrastructure/llm/tools/cancel-event.tool.js

import { z } from "zod";

export const cancelEventToolDef = {
  name: "cancel_event",

  description: `
Cancel an existing conference event.

Use this when the user wants to:
- cancel an event
- remove a workshop
- delete a session
- cancel a keynote
- drop a conference talk

This performs a soft cancellation.
The event is retained for auditing.
Notification emails are queued asynchronously.
`,

  schema: z
    .object({
      conferenceId: z
        .string()
        .uuid()
        .describe("Conference UUID"),

      eventId: z
        .string()
        .uuid()
        .describe("Event UUID"),

      reason: z
        .string()
        .trim()
        .min(5)
        .max(500)
        .describe("Reason for cancellation"),

      notifyAttendees: z
        .boolean()
        .default(true)
        .describe("Notify registered attendees"),

      notifySpeakers: z
        .boolean()
        .default(true)
        .describe("Notify speakers"),

      refundTickets: z
        .boolean()
        .default(false)
        .describe("Refund paid registrations if applicable"),

      idempotencyKey: z
        .string()
        .uuid()
        .describe("Idempotency key")
    })
    .strict(),

  useCase: "CancelEventUseCase",

  requiresRole: ["organizer", "admin"],

  featureFlag: "llm_cancel_event",

  rateLimit: {
    perUserPerMinute: 10,
    perEventPerMinute: 2
  },

  estimatedCost: {
    inputTokens: 200,
    outputTokens: 80
  },

  telemetry: {
    operation: "cancel_event"
  },

  responseContract: {
    success: {
      eventId: "uuid",
      status: "cancelled",
      cancelledAt: "ISO8601",
      notificationsQueued: true
    },

    errors: [
      "EVENT_NOT_FOUND",
      "EVENT_ALREADY_CANCELLED",
      "EVENT_ALREADY_FINISHED",
      "UNAUTHORIZED",
      "VALIDATION_ERROR"
    ]
  }
};

export const CancelEventInput =
  cancelEventToolDef.schema;