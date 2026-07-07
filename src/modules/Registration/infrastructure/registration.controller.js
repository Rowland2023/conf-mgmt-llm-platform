// src/modules/registration/infrastructure/Registration.controller.js

export class RegistrationController {
  /**
   * Inject Use Cases via constructor to maintain clean separation of concerns
   */
  constructor({ 
    createRegistrationUseCase, 
    updateRegistrationUseCase, 
    getRegistrationUseCase, 
    getAllRegistrationsUseCase, // 1. Fixed parameter casing
    deleteRegistrationUseCase 
  }) {
    this.createRegistrationUseCase = createRegistrationUseCase;
    this.updateRegistrationUseCase = updateRegistrationUseCase;
    this.getRegistrationUseCase = getRegistrationUseCase;
    // 2. Fixed assignment reference mismatch and unified property names
    this.getAllRegistrationsUseCase = getAllRegistrationsUseCase; 
    this.deleteRegistrationUseCase = deleteRegistrationUseCase;
  }

  async create(req, res, next) {
    try {
      // Security enforcement: Merge validated body data with authenticated user token ID
      const useCaseInput = {
        ...req.body,
        userId: req.user.id
      };

      const registration = await this.createRegistrationUseCase.execute(useCaseInput);

      return res.status(201).json({
        status: 'success',
        data: { registration: registration.toDTO() } // Use a clean DTO to avoid leaky domain structures
      });
    } catch (error) {
      next(error); // Let your global Express error-handler deal with the rest
    }
  }

  async index(req, res, next) {
    try {
      // 3. Fixed: Changed listRegistrationsUseCase to the correctly assigned instance property name
      const result = await this.getAllRegistrationsUseCase.execute(req.query);

      return res.status(200).json({
        status: 'success',
        meta: {
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          currentPage: req.query.page,
          limit: req.query.limit
        },
        data: {
          registrations: result.items.map(item => item.toDTO())
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async show(req, res, next) {
    try {
      const { id } = req.params;
      const registration = await this.getRegistrationUseCase.execute({ id });

      if (!registration) {
        return res.status(404).json({
          status: 'fail',
          message: `Registration with ID ${id} not found.`
        });
      }

      return res.status(200).json({
        status: 'success',
        data: { registration: registration.toDTO() }
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { ticketTier, attendeeNotes, expectedVersion } = req.body;

      const updatedRegistration = await this.updateRegistrationUseCase.execute({
        id,
        ticketTier,
        attendeeNotes,
        expectedVersion,
        requestedBy: req.user.id // Pass identity down to verify ownership/permissions inside domain rules
      });

      return res.status(200).json({
        status: 'success',
        data: { registration: updatedRegistration.toDTO() }
      });
    } catch (error) {
      // Gracefully capture your repository's OCC error message and transform it to an HTTP 409 Conflict status
      if (error.message.includes('Concurrency Conflict')) {
        return res.status(409).json({
          status: 'fail',
          message: error.message
        });
      }
      next(error);
    }
  }

  async destroy(req, res, next) {
    try {
      const { id } = req.params;

      await this.deleteRegistrationUseCase.execute({
        id,
        requestedBy: req.user.id,
      });

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}