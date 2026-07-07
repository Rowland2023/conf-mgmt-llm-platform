// src/modules/registration/infrastructure/registration.schema.js
import { z } from 'zod';

export const TICKET_TIERS = Object.freeze(['EARLY_BIRD', 'GENERAL', 'VIP', 'STUDENT']);
export const REGISTRATION_STATUSES = Object.freeze(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED']);
export const SORT_FIELDS = Object.freeze(['createdAt', 'status', 'ticketTier', 'updatedAt']);

/**
 * 1. Schema for HTTP POST /registrations
 */
export const createRegistrationSchema = z.object({
  body: z.object({
    conferenceId: z
      .string({ required_error: 'Conference ID is required' })
      .uuid({ message: 'Invalid Conference ID format' }),
    
    ticketTier: z.enum(TICKET_TIERS, {
      errorMap: () => ({ message: `Ticket tier must be one of: ${TICKET_TIERS.join(', ')}` }),
    }),
    
    attendeeNotes: z
      .string()
      .max(1000, { message: 'Attendee notes cannot exceed 1000 characters' })
      .nullish()
      .transform((val) => (val?.trim() ? val.trim() : null)),
  }).strict(),
});

/**
 * 2. Schema for HTTP PATCH /registrations/:id
 * Safeguarded against concurrency race-conditions using mandatory OCC checking.
 */
export const updateRegistrationSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid registration ID' }),
  }),
  body: z.object({
    ticketTier: z.enum(TICKET_TIERS).optional(),
    
    attendeeNotes: z
      .string()
      .max(1000, { message: 'Attendee notes cannot exceed 1000 characters' })
      .nullish()
      .transform((val) => (val?.trim() ? val.trim() : null)),
    
    expectedVersion: z
      .number({ 
        required_error: 'expectedVersion is required to prevent lost updates',
        invalid_type_error: 'expectedVersion must be a valid integer' 
      })
      .int()
      .positive({ message: 'expectedVersion must be a positive integer greater than 0' }),
  })
    .strict()
    // Refinement ensures the user isn't making a redundant request with ONLY the version tag
    .refine(
      (bodyData) => {
        if (!bodyData) return false;
        const { expectedVersion, ...updatableFields } = bodyData;
        return Object.keys(updatableFields).length > 0;
      },
      {
        message: 'At least one field besides expectedVersion must be provided for update',
        path: ['body'], // Points the error layout directly to the body element property array
      }
    ),
});

/**
 * 3. Schema for HTTP GET /registrations (Query Parameters)
 */
export const findAllRegistrationsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number({ invalid_type_error: 'Page must be a numeric value' })
      .int({ message: 'Page must be an integer' })
      .positive({ message: 'Page must be greater than 0' })
      .default(1),
    
    limit: z.coerce
      .number({ invalid_type_error: 'Limit must be a numeric value' })
      .int({ message: 'Limit must be an integer' })
      .positive({ message: 'Limit must be greater than 0' })
      .default(10)
      .transform((val) => Math.min(val, 100)), // Defensive security cap against memory pool exhaustion
    
    conferenceId: z.string().uuid({ message: 'Invalid conferenceId query filter format' }).optional(),
    userId: z.string().uuid({ message: 'Invalid userId query filter format' }).optional(),
    
    status: z.enum(REGISTRATION_STATUSES).optional(),
    ticketTier: z.enum(TICKET_TIERS).optional(),
    
    sortBy: z.enum(SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
});

/**
 * 4. Schema for plain ID-based target paths
 */
export const registrationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid registration ID' }),
  }),
});