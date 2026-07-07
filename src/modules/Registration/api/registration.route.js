import { Router } from 'express';
import { authGuard } from '../../../shared/middleware/authGuard.js';
import { validate } from '../../../shared/middleware/validate.js';
import {
  createRegistrationSchema,
  updateRegistrationSchema,
} from './validators/registration.schema.js';

export const getRegistrationRoutes = (registrationController) => {
  const router = Router();

  router.post(
    '/',
    authGuard,
    validate(createRegistrationSchema),
    registrationController.createRegistration
  );

  router.get(
    '/',
    authGuard,
    registrationController.getAllRegistrations
  );

  router.get(
    '/:id',
    authGuard,
    registrationController.getRegistrationById
  );

  router.patch(
    '/:id',
    authGuard,
    validate(updateRegistrationSchema),
    registrationController.updateRegistration
  );

  router.delete(
    '/:id',
    authGuard,
    registrationController.cancelRegistration
  );

  return router;
};