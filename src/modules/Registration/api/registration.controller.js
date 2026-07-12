import { toResponseDto } from '../mappers/RegistrationMapper.js';
import { createRegistrationSchema, updateRegistrationSchema } from '../validators/registration.validator.js';

export class RegistrationController {
  constructor({ 
    createRegistrationUseCase, 
    getRegistrationUseCase, 
    getAllRegistrationsUseCase, 
    updateRegistrationUseCase, 
    cancelRegistrationUseCase, 
    checkInRegistrationUseCase,
    logger // <-- Inject your ILogger contract here
  }) {
    this.createRegistrationUseCase = createRegistrationUseCase;
    this.getRegistrationUseCase = getRegistrationUseCase;
    this.getAllRegistrationsUseCase = getAllRegistrationsUseCase;
    this.updateRegistrationUseCase = updateRegistrationUseCase;
    this.cancelRegistrationUseCase = cancelRegistrationUseCase;
    this.checkInRegistrationUseCase = checkInRegistrationUseCase;
    this.logger = logger;
  }

  /**
   * Internal helper to extract or initialize standard tracing metadata 
   * from the incoming express request headers.
   */
  _getTracingContext(req) {
    return {
      correlationId: req.headers['x-correlation-id'] || globalThis.crypto?.randomUUID() || req.id,
      causationId: req.headers['x-request-id'] || null
    };
  }

  createRegistration = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      const { error, value } = createRegistrationSchema.validate(req.body);
      if (error) return res.status(400).json({ message: error.details[0].message });

      // Pass tracing Context to use case if you want events to carry tracing IDs
      const registration = await this.createRegistrationUseCase.execute({
        attendeeId: req.user.id,
        ...value,
      }, req.user, tracingContext);

      this.logger.info('Registration processing completed successfully', {
        registrationId: registration.id,
        userId: req.user.id,
        ...tracingContext
      });

      res.status(201).json(toResponseDto(registration));
    } catch (error) {
      this.logger.error('Registration pipeline creation sequence failed', {
        error,
        body: req.body,
        userId: req.user?.id,
        ...tracingContext
      });
      next(error);
    }
  };

  getRegistrationById = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      const registration = await this.getRegistrationUseCase.execute({
        id: req.params.id,
        currentUser: req.user
      });
      res.status(200).json(toResponseDto(registration));
    } catch (error) {
      this.logger.error('Failed to retrieve registration data record', {
        error,
        registrationId: req.params.id,
        ...tracingContext
      });
      next(error);
    }
  };

  getAllRegistrations = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.getAllRegistrationsUseCase.execute({
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        filters,
        currentUser: req.user
      });
      res.status(200).json({
        data: result.items.map(toResponseDto),
        meta: { page: result.page, limit: result.limit, total: result.total }
      });
    } catch (error) {
      this.logger.error('Bulk query list fetch execution failed', {
        error,
        query: req.query,
        ...tracingContext
      });
      next(error);
    }
  };

  updateRegistration = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      const { error, value } = updateRegistrationSchema.validate(req.body);
      if (error) return res.status(400).json({ message: error.details[0].message });

      const registration = await this.updateRegistrationUseCase.execute({
        id: req.params.id,
        data: value,
        currentUser: req.user
      }, tracingContext);

      this.logger.info('Registration data record mutations saved successfully', {
        registrationId: req.params.id,
        ...tracingContext
      });

      res.status(200).json(toResponseDto(registration));
    } catch (error) {
      this.logger.error('Registration properties mutation block failed', {
        error,
        registrationId: req.params.id,
        ...tracingContext
      });
      next(error);
    }
  };

  checkInRegistration = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      const registration = await this.checkInRegistrationUseCase.execute({
        id: req.params.id,
        currentUser: req.user
      }, tracingContext);

      this.logger.info('Attendee physical check-in recorded cleanly', {
        registrationId: req.params.id,
        ...tracingContext
      });

      res.status(200).json(toResponseDto(registration));
    } catch (error) {
      this.logger.error('Gate check-in event execution halted', {
        error,
        registrationId: req.params.id,
        ...tracingContext
      });
      next(error);
    }
  };

  cancelRegistration = async (req, res, next) => {
    const tracingContext = this._getTracingContext(req);
    try {
      await this.cancelRegistrationUseCase.execute({
        id: req.params.id,
        currentUser: req.user
      }, tracingContext);

      this.logger.info('Registration state cancelled and inventory slot returned', {
        registrationId: req.params.id,
        ...tracingContext
      });

      res.status(204).send();
    } catch (error) {
      this.logger.error('Registration cancellation state routine failed', {
        error,
        registrationId: req.params.id,
        ...tracingContext
      });
      next(error);
    }
  };
}