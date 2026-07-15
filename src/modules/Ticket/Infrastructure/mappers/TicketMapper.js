// src/modules/ticket/infrastructure/persistence/mappers/TicketMapper.js

import { Ticket } from "../../../domain/entities/Ticket.js";
import { Money } from "../../../domain/valueObjects/Money.js";

export class TicketMapper {
  static toDomain(model) {
    return Ticket.rehydrate({
      id: model.id,
      conferenceId: model.conferenceId,
      type: model.type,
      price: new Money(
        model.priceAmount,
        model.priceCurrency
      ),
      capacity: model.capacity,
      reserved: model.reserved,
      sold: model.sold,
      status: model.status,
      version: model.version,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt
    });
  }

  static toPersistence(ticket) {
    return {
      id: ticket.id,
      conferenceId: ticket.conferenceId,
      type: ticket.type,
      priceAmount: ticket.price.amount,
      priceCurrency: ticket.price.currency,
      capacity: ticket.capacity,
      reserved: ticket.reserved,
      sold: ticket.sold,
      status: ticket.status,
      version: ticket.version
    };
  }
}