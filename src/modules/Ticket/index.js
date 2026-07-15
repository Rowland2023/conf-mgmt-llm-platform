// src/modules/ticket/index.js

// Infrastructure
import { TicketModelDefine } from "./infrastructure/persistence/models/TicketModel.js";
import { TicketMapper } from "./infrastructure/persistence/mappers/TicketMapper.js";
import { PostgresTicketRepository } from "./infrastructure/persistence/repositories/PostgresTicketRepository.js";

// Application
import { CreateTicketUseCase } from "./application/useCases/CreateTicketUseCase.js";
import { ReserveTicketUseCase } from "./application/useCases/ReserveTicketUseCase.js";
import { ReleaseTicketUseCase } from "./application/useCases/ReleaseTicketUseCase.js";
import { PurchaseTicketUseCase } from "./application/useCases/PurchaseTicketUseCase.js";
import { CancelTicketUseCase } from "./application/useCases/CancelTicketUseCase.js";

export function createTicketModule({
  sequelize,
  transactionManager,
  outboxRepository
}) {
  // Define Sequelize model
  const TicketModel = TicketModelDefine(sequelize);

  // Repository
  const ticketRepository = new PostgresTicketRepository({
    model: TicketModel,
    mapper: TicketMapper,
    transactionManager,
    outboxRepository
  });

  // Use Cases
  const createTicket = new CreateTicketUseCase({
    ticketRepository,
    transactionManager
  });

  const reserveTicket = new ReserveTicketUseCase({
    ticketRepository,
    transactionManager
  });

  const releaseTicket = new ReleaseTicketUseCase({
    ticketRepository,
    transactionManager
  });

  const purchaseTicket = new PurchaseTicketUseCase({
    ticketRepository,
    transactionManager
  });

  const cancelTicket = new CancelTicketUseCase({
    ticketRepository,
    transactionManager
  });

  return {
    repository: ticketRepository,

    useCases: {
      createTicket,
      reserveTicket,
      releaseTicket,
      purchaseTicket,
      cancelTicket
    }
  };
}