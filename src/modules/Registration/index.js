// src/modules/registration/index.js

// 1. Infrastructure Core
import { RegistrationRepository } from './infrastructure/RegistrationRepository.js';
import { RegistrationController } from './infrastructure/Registration.controller.js';
import { createRegistrationRouter } from './infrastructure/registration.routes.js';

// 2. Application Use Cases
import { CreateRegistrationUseCase } from './application/user-cases/CreateRegistrationUseCase.js';
import { UpdateRegistrationUseCase } from './application/user-cases/UpdateRegistrationUseCase.js';
import { GetRegistrationUseCase } from './application/user-cases/GetRegistrationUseCase.js';
import { GetAllRegistrationsUseCase } from './application/user-cases/GetAllRegistrationsUseCase.js';

/**
 * Initializes the entire Registration Module.
 * @param {Object} dbConnection - The Knex database client connection instance.
 * @returns {Function} Express Router configured with full dependency trees.
 */
export function initRegistrationModule(dbConnection) {
  // A. Initialize Repository with db driver context
  const registrationRepository = new RegistrationRepository(dbConnection);

  // B. Instantiate Use Cases with injected repositories/services
  const createRegistrationUseCase = new CreateRegistrationUseCase({
    registrationRepository,
  });

  const updateRegistrationUseCase = new UpdateRegistrationUseCase({
    registrationRepository,
  });

  const getRegistrationUseCase = new GetRegistrationUseCase({
    registrationRepository,
  });

  const getAllRegistrationsUseCase = new GetAllRegistrationsUseCase({
    registrationRepository,
  });

  // C. Inject Use Cases into Controller
  const registrationController = new RegistrationController({
    createRegistrationUseCase,
    updateRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
  });

  // D. Pass controller handlers into Router generator
  const registrationRouter = createRegistrationRouter(registrationController);

  return registrationRouter;
}