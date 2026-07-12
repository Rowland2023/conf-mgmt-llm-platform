import { Router } from 'express';
import { authGuard } from '../../../shared/middleware/authGuard.js';
import { validate } from '../../../shared/middleware/validate.js';
import {
  createRegistrationSchema,
  updateRegistrationSchema,
  registrationIdSchema,
  registrationQuerySchema,
  checkInRegistrationSchema,
  cancelRegistrationSchema
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
    validate(registrationQuerySchema), // Added query parameters validation
    registrationController.getAllRegistrations
  );

  router.get(
    '/:id',
    authGuard,
    validate(registrationIdSchema), // Added structural path ID validation
    registrationController.getRegistrationById
  );

  router.patch(
    '/:id',
    authGuard,
    validate(updateRegistrationSchema),
    registrationController.updateRegistration
  );

  router.post(
    '/:id/check-in', // Added missing operational endpoint mapping
    authGuard,
    validate(checkInRegistrationSchema),
    registrationController.checkInRegistration
  );

  router.delete(
    '/:id',
    authGuard,
    validate(cancelRegistrationSchema), // Added removal schema validation
    registrationController.cancelRegistration
  );

  return router;
};