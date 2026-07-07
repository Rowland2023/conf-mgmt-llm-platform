// src/modules/registration/infrastructure/registration.routes.js
import { Router } from 'express';
import { validate } from '../../../shared/infrastructure/middleware/validate.js';
import { authenticate } from '../../../shared/infrastructure/middleware/authenticate.js';
import { rateLimit } from '../../../shared/infrastructure/middleware/rateLimit.js';
import { idempotency } from '../../../shared/infrastructure/middleware/idempotency.js';
import { 
  createRegistrationSchema, 
  updateRegistrationSchema, 
  findAllRegistrationsSchema, 
  registrationIdParamSchema 
} from './registration.schema.js';

export function createRegistrationRouter(registrationController) {
  const router = Router();

  // 1. Core Security Boundary
  router.use(authenticate);

  // 2. Resource Endpoints
  router.post(
    '/',
    validate(createRegistrationSchema), // 1st: Reject structurally malformed payloads instantly
    rateLimit({ id: 'create-reg', max: 10, windowMs: 60000, keyMode: 'user' }), // 2nd: Rate limit validated traffic
    idempotency, // 3rd: Safe operational state guard for sound traffic
    registrationController.create.bind(registrationController)
  );

  router.get(
    '/',
    validate(findAllRegistrationsSchema),
    rateLimit({ id: 'list-reg', max: 60, windowMs: 60000, keyMode: 'user' }),
    registrationController.index.bind(registrationController)
  );

  router.get(
    '/:id',
    validate(registrationIdParamSchema),
    rateLimit({ id: 'get-reg', max: 120, windowMs: 60000, keyMode: 'user' }),
    registrationController.show.bind(registrationController)
  );

  router.patch(
    '/:id',
    validate(updateRegistrationSchema),
    rateLimit({ id: 'update-reg', max: 30, windowMs: 60000, keyMode: 'user' }),
    registrationController.update.bind(registrationController)
  );

  router.delete(
    '/:id',
    validate(registrationIdParamSchema),
    rateLimit({ id: 'delete-reg', max: 10, windowMs: 60000, keyMode: 'user' }),
    registrationController.destroy.bind(registrationController)
  );

  return router;
}