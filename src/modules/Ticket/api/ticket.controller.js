// src/modules/ticket/api/ticket.controller.js
export class TicketController {
  #createTicketUseCase;
  #getTicketUseCase;
  #listTicketsUseCase;
  #reserveTicketUseCase;
  #releaseTicketUseCase;
  #cancelTicketUseCase;

  constructor({
    createTicketUseCase,
    getTicketUseCase,
    listTicketsUseCase,
    reserveTicketUseCase,
    releaseTicketUseCase,
    cancelTicketUseCase
  }) {
    this.#createTicketUseCase = createTicketUseCase;
    this.#getTicketUseCase = getTicketUseCase;
    this.#listTicketsUseCase = listTicketsUseCase;
    this.#reserveTicketUseCase = reserveTicketUseCase;
    this.#releaseTicketUseCase = releaseTicketUseCase;
    this.#cancelTicketUseCase = cancelTicketUseCase;
  }

  /**
   * Extracts tracing and idempotency context from HTTP request.
   * Used by all mutating operations for audit trail + duplicate prevention.
   */
  #getTracingContext(req) {
    return {
      correlationId: req.headers['x-correlation-id'] || req.headers['correlation-id'] || null,
      idempotencyKey: req.headers['idempotency-key'] || null,
      userId: req.user?.id || null
    };
  }

  async createTicket(req, res, next) {
    try {
      const { correlationId, idempotencyKey } = this.#getTracingContext(req);
      const { conferenceId, type, price, currency, quantity } = req.body;

      const ticketDto = await this.#createTicketUseCase.execute({
        conferenceId,
        type,
        price,
        currency,
        quantity,
        correlationId,
        idempotencyKey
      });

      return res.status(201).json({ success: true, data: ticketDto });
    } catch (error) {
      next(error);
    }
  }

  async getTicketById(req, res, next) {
    try {
      const { id } = req.params;
      const ticketDto = await this.#getTicketUseCase.execute({ id });

      if (!ticketDto) {
        return res.status(404).json({ success: false, message: "Ticket not found." });
      }

      return res.status(200).json({ success: true, data: ticketDto });
    } catch (error) {
      next(error);
    }
  }

  async listTickets(req, res, next) {
    try {
      const { conferenceId } = req.query;
      const tickets = await this.#listTicketsUseCase.execute({ conferenceId });

      return res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }

  async reserveTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { correlationId, userId, idempotencyKey } = this.#getTracingContext(req);
      const { quantity } = req.body;

      const ticketDto = await this.#reserveTicketUseCase.execute({
        ticketId: id,
        userId,
        quantity: parseInt(quantity, 10),
        correlationId,
        idempotencyKey
      });

      return res.status(200).json({ success: true, data: ticketDto });
    } catch (error) {
      next(error);
    }
  }

  async releaseTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { correlationId, idempotencyKey } = this.#getTracingContext(req);
      const { quantity } = req.body;

      const ticketDto = await this.#releaseTicketUseCase.execute({
        ticketId: id,
        quantity: parseInt(quantity, 10),
        correlationId,
        idempotencyKey
      });

      return res.status(200).json({ success: true, data: ticketDto });
    } catch (error) {
      next(error);
    }
  }

  async cancelTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { correlationId, userId, idempotencyKey } = this.#getTracingContext(req);
      const { reason } = req.body;

      const ticketDto = await this.#cancelTicketUseCase.execute({
        ticketId: id,
        userId,
        reason,
        correlationId,
        idempotencyKey
      });

      return res.status(200).json({ success: true, data: ticketDto });
    } catch (error) {
      next(error);
    }
  }
}