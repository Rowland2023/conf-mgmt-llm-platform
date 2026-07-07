export class RegistrationController {
  constructor({
    createRegistrationUseCase,
    getRegistrationUseCase,
    getAllRegistrationsUseCase,
    updateRegistrationUseCase,
    cancelRegistrationUseCase,
    checkInRegistrationUseCase,
  }) {
    this.createRegistrationUseCase = createRegistrationUseCase;
    this.getRegistrationUseCase = getRegistrationUseCase;
    this.getAllRegistrationsUseCase = getAllRegistrationsUseCase;
    this.updateRegistrationUseCase = updateRegistrationUseCase;
    this.cancelRegistrationUseCase = cancelRegistrationUseCase;
    this.checkInRegistrationUseCase = checkInRegistrationUseCase;
  }

  createRegistration = async (req, res, next) => {
    try {
      const registration = await this.createRegistrationUseCase.execute({
        attendeeId: req.user.id,
        ...req.body,
      });

      res.status(201).json(registration);
    } catch (error) {
      next(error);
    }
  };

  getRegistrationById = async (req, res, next) => {
    try {
      const registration =
        await this.getRegistrationUseCase.execute(req.params.id);

      res.status(200).json(registration);
    } catch (error) {
      next(error);
    }
  };

  getAllRegistrations = async (req, res, next) => {
    try {
      const registrations =
        await this.getAllRegistrationsUseCase.execute(req.query);

      res.status(200).json(registrations);
    } catch (error) {
      next(error);
    }
  };

  updateRegistration = async (req, res, next) => {
    try {
      const registration =
        await this.updateRegistrationUseCase.execute(
          req.params.id,
          req.body
        );

      res.status(200).json(registration);
    } catch (error) {
      next(error);
    }
  };

  checkInRegistrationUseCase = async (req, res, next) => {
    try {
      const registration =
        await this.checkInRegistrationUseCase.execute(req.params.id);   
        
        res.status(200).json(registration);
    }   catch (error) {   
        next(error);
    }
  };

  cancelRegistration = async (req, res, next) => {
    try {
      await this.cancelRegistrationUseCase.execute(req.params.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}