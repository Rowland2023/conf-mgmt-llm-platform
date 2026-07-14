// src/modules/ticket/api/ticket.route.js
import { Router } from 'express';
import { idempotencyMiddleware } from '../../shared/middleware/idempotency.js';
import { correlationIdMiddleware } from '../../shared/middleware/correlationId.js';

/**
 * Ticket module HTTP router factory
 * 
 * All routes require X-Correlation-Id header for audit trail.
 * Mutating routes require Idempotency-Key to prevent double-booking.
 * 
 * @param {TicketController} ticketController
 * @returns {Router}
 */
export function createTicketRouter(ticketController) {
  const router = Router();

  // Apply correlation ID to all routes
  router.use(correlationIdMiddleware);

  // Commands - mutating operations
  router.post('/', 
    idempotencyMiddleware,
    (req, res, next) => ticketController.createTicket(req, res, next)
  );
  
  router.post('/:id/reserve',
    idempotencyMiddleware,
    (req, res, next) => ticketController.reserveTicket(req, res, next)
  );
  
  router.post('/:id/release',
    idempotencyMiddleware,
    (req, res, next) => ticketController.releaseTicket(req, res, next)
  );
  
  router.post('/:id/cancel',
    idempotencyMiddleware,
    (req, res, next) => ticketController.cancelTicket(req, res, next)
  );

  // Queries - read operations
  router.get('/', (req, res, next) => ticketController.listTickets(req, res, next));
  router.get('/:id', (req, res, next) => ticketController.getTicketById(req, res, next));

  return router;
}