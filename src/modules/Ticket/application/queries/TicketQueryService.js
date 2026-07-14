// src/modules/ticket/application/query-services/TicketQueryService.js
import { TicketNotFoundError } from "../errors/TicketNotFoundError.js";

export class TicketQueryService {
  #ticketRepository;
  #logger;
  #maxLimit = 100; // Protects DB memory from excessive query payloads

  constructor({ ticketRepository, logger }) {
    this.#ticketRepository = ticketRepository;
    this.#logger = logger;
  }

  async getById(ticketId, { correlationId } = {}) {
    this.#logger.debug({ ticketId, correlationId }, 'Getting ticket by id');
    
    const ticket = await this.#ticketRepository.findById(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    // Defensive: Return a read-only projection (DTO) rather than the rich Domain Aggregate
    return this.#toDTO(ticket);
  }

  async list({
    conferenceId,
    status,
    type,
    page = 1,
    limit = 20,
    correlationId
  }) {
    this.#logger.debug({ conferenceId, status, type, page, limit, correlationId }, 'Listing tickets');
    
    const sanitizedLimit = Math.min(Number(limit) || 20, this.#maxLimit);
    const sanitizedPage = Math.max(Number(page) || 1, 1);

    const results = await this.#ticketRepository.findAll({
      conferenceId,
      status,
      type,
      page: sanitizedPage,
      limit: sanitizedLimit
    });

    // Map to clean DTOs if the repository returns rich domain models
    return {
      items: results.items.map(item => this.#toDTO(item)),
      pagination: results.pagination
    };
  }

  /**
   * Optimized projection query - doesn't hydrate full aggregate
   * Use this for availability checks in hot path
   */
  async getAvailability(ticketId, { correlationId } = {}) {
    this.#logger.debug({ ticketId, correlationId }, 'Fetching ticket availability');
    
    const availability = await this.#ticketRepository.findAvailability(ticketId);
    if (!availability) {
      throw new TicketNotFoundError(ticketId);
    }

    this.#logger.debug({ 
      ticketId, 
      available: availability.available,
      correlationId 
    }, 'Availability fetched');

    return availability; // Already a simple read-model/DTO
  }

  async exists(ticketId) {
    return this.#ticketRepository.exists(ticketId);
  }

  async countByConference(conferenceId, { correlationId } = {}) {
    this.#logger.debug({ conferenceId, correlationId }, 'Counting tickets by conference');
    return this.#ticketRepository.countByConference(conferenceId);
  }

  async search({
    conferenceId,
    keyword,
    status,
    page = 1,
    limit = 20,
    correlationId
  }) {
    this.#logger.debug({ conferenceId, keyword, status, page, limit, correlationId }, 'Searching tickets');
    
    const sanitizedLimit = Math.min(Number(limit) || 20, this.#maxLimit);
    const sanitizedPage = Math.max(Number(page) || 1, 1);

    const results = await this.#ticketRepository.search({
      conferenceId,
      keyword,
      status,
      page: sanitizedPage,
      limit: sanitizedLimit
    });

    return {
      items: results.items.map(item => this.#toDTO(item)),
      pagination: results.pagination
    };
  }

  /**
   * Helper to serialize and decouple domain internals from presentation models
   */
  #toDTO(ticket) {
    // If it's already a plain object/DTO from the repository, pass it through.
    // Otherwise, serialize the aggregate safely.
    if (typeof ticket.toJSON === 'function') {
      return ticket.toJSON();
    }
    return {
      id: ticket.id,
      conferenceId: ticket.conferenceId,
      type: ticket.type,
      price: ticket.price?.amount || ticket.price,
      currency: ticket.price?.currency || ticket.currency,
      capacity: ticket.capacity,
      reserved: ticket.reserved,
      sold: ticket.sold,
      status: ticket.status
    };
  }
}