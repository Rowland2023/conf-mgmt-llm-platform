// modules/registration/index.js
import { UnitOfWork } from "../../shared/infrastructure/UnitOfWork.js";
import { PostgresRegistrationRepository } from "./infrastructure/persistence/repositories/PostgresRegistrationRepository.js";
import { PostgresOutboxRepository } from "./infrastructure/persistence/repositories/PostgresOutboxRepository.js"; // <-- Import locally
import { RegistrationMapper } from "./infrastructure/persistence/mappers/RegistrationMapper.js";

import { CreateRegistrationUseCase } from "./application/use-cases/CreateRegistrationUseCase.js";
import { GetRegistrationUseCase } from "./application/use-cases/GetRegistrationUseCase.js";
import { GetAllRegistrationsUseCase } from "./application/use-cases/GetAllRegistrationsUseCase.js";
import { UpdateRegistrationUseCase } from "./application/use-cases/UpdateRegistrationUseCase.js";
import { CancelRegistrationUseCase } from "./application/use-cases/CancelRegistrationUseCase.js";
import { CheckInRegistrationUseCase } from "./application/use-cases/CheckInRegistrationUseCase.js";

import { RegistrationController } from "./api/registration.controller.js";
import { getRegistrationRoutes } from "./api/registration.route.js";

/**
 * Composition Root for Registration module.
 * All dependencies wired here. No DI containers.
 */
export function createRegistrationModule({
  db,
  logger,
  config
}) {
  // 1. Fail fast on core system dependencies
  if (!db) throw new Error("Registration Module: 'db' connection is required.");
  if (!logger) throw new Error("Registration Module: 'logger' is required.");

  // 2. UnitOfWork - single source of truth for transactions within this module
  const uow = new UnitOfWork(db);

  // 3. Infrastructure - Enforce module boundaries by creating the repository locally
  const registrationMapper = new RegistrationMapper();
  const registrationRepository = new PostgresRegistrationRepository({ uow, registrationMapper });
  const outboxRepository = new PostgresOutboxRepository({ uow }); // <-- Bound to local module transaction context

  // 4. Use Cases
  const createRegistrationUseCase = new CreateRegistrationUseCase({
    registrationRepository,
    outboxRepository,
    uow,
    logger
  });

  const getRegistrationUseCase = new GetRegistrationUseCase({
    registrationRepository,
    logger
  });

  const getAllRegistrationsUseCase = new GetAllRegistrationsUseCase({
    registrationRepository,
    logger
  });

  const updateRegistrationUseCase = new UpdateRegistrationUseCase({
    registrationRepository,
    outboxRepository,
    uow,
    logger
  });

  const cancelRegistrationUseCase = new CancelRegistrationUseCase({
    registrationRepository,
    outboxRepository,
    uow,
    logger
  });

  const checkInRegistrationUseCase = new CheckInRegistrationUseCase({
    registrationRepository,
    outboxRepository,
    uow,
    logger
  });

  // 5. Presentation
  const registrationController = new RegistrationController({
    createRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
    updateRegistrationUseCase,
    cancelRegistrationUseCase,
    checkInRegistrationUseCase
  });

  const router = getRegistrationRoutes(registrationController);

  // 6. Module API - ONLY public surface
  return {
    router,
    
    subscribe: (eventBus) => {
      if (!eventBus) {
        logger.warn("Registration Module: No eventBus provided. Skipping subscriptions.");
        return;
      }

      // Auto-cancel registration if conference is deleted
      eventBus.subscribe('conference.deleted', async (evt) => {
        try {
          await cancelRegistrationUseCase.execute({
            conferenceId: evt.conferenceId,
            reason: 'CONFERENCE_CANCELLED',
            correlationId: evt.correlationId
          });
        } catch (err) {
          logger.error(
            { err, conferenceId: evt.conferenceId, correlationId: evt.correlationId },
            "Failed to execute cancelRegistrationUseCase following conference.deleted event"
          );
        }
      });
    },
    
    start: async () => {
      logger.info('Registration module infrastructure started successfully.');
    },
    stop: async () => {
      logger.info('Registration module cleanly stopped.');
    }
  };
}