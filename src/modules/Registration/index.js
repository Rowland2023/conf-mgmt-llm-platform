// modules/registration/index.js

// 1. Infrastructure Layer Dependencies
import { PostgresRegistrationRepository } from "./infrastructure/persistence/repositories/PostgresRegistrationRepository.js";
import { RegistrationMapper } from "./infrastructure/persistence/mappers/RegistrationMapper.js";

// 2. Application Layer Use Cases
import { CreateRegistrationUseCase } from "./application/use-cases/CreateRegistrationUseCase.js";
import { GetRegistrationUseCase } from "./application/use-cases/GetRegistrationUseCase.js";
import { GetAllRegistrationsUseCase } from "./application/use-cases/GetAllRegistrationsUseCase.js";
import { UpdateRegistrationUseCase } from "./application/use-cases/UpdateRegistrationUseCase.js";
import { CancelRegistrationUseCase } from "./application/use-cases/CancelRegistrationUseCase.js";
import { CheckInRegistrationUseCase } from "./application/use-cases/CheckInRegistrationUseCase.js";

// 3. Presentation Layer Components (Direct Imports)
import { RegistrationController } from "./api/registration.controller.js";
import { getRegistrationRoutes } from "./api/registration.route.js";

/**
 * Composition Root factory organizing the Registration system module.
 * Instantiates and wires up all layers internally without needing an api/index.js facade.
 */
export function createRegistrationModule({
  db,
  redis,
  logger,
  transactionManager,
  outboxRepository,
  conferenceRepository,
  eventBus,
  config
}) {

  // =========================================================================
  // 1. Infrastructure Assembly
  // =========================================================================
  const registrationMapper = new RegistrationMapper();

  const registrationRepository = new PostgresRegistrationRepository({
    db,
    registrationMapper
  });

  // =========================================================================
  // 2. Application Use Cases Assembly
  // =========================================================================
  const createRegistrationUseCase = new CreateRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    transactionManager,
    outboxRepository,
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
    transactionManager,
    outboxRepository,
    logger
  });

  const cancelRegistrationUseCase = new CancelRegistrationUseCase({
    registrationRepository,
    conferenceRepository,
    outboxRepository,
    transactionManager
  });

  const checkInRegistrationUseCase = new CheckInRegistrationUseCase({
    registrationRepository,
    transactionManager,
    outboxRepository,
    logger
  });

  // =========================================================================
  // 3. Presentation Integration (Wired Directly)
  // =========================================================================
  const registrationController = new RegistrationController({
    createRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
    updateRegistrationUseCase,
    cancelRegistrationUseCase,
    checkInRegistrationUseCase
  });

  // Generate the Express router by passing the controller straight into it
  const router = getRegistrationRoutes(registrationController);

  // =========================================================================
  // 4. Clean Module Manifest Exports
  // =========================================================================
  return {
    router, 
    controller: registrationController,

    repositories: {
      registrationRepository
    },

    useCases: {
      createRegistrationUseCase,
      getRegistrationUseCase,
      getAllRegistrationsUseCase,
      updateRegistrationUseCase,
      cancelRegistrationUseCase,
      checkInRegistrationUseCase
    }
  };
}