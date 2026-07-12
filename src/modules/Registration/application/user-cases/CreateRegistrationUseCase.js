import { NotFoundError, BusinessRuleValidationError } from '../../domain/errors/DomainErrors.js';
import { Registration } from '../../domain/entities/Registration.js';

export class CreateRegistrationUseCase {
  constructor({ 
    registrationRepository, 
    conferenceRepository, 
    outboxRepository, 
    uuidService, 
    transactionManager,
    logger // NEW
  }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository;
    this.outboxRepository = outboxRepository;
    this.uuidService = uuidService;
    this.transactionManager = transactionManager;
    this.logger = logger.child({ useCase: 'CreateRegistrationUseCase' }); // bound context
  }

  async execute(payload, currentUser) {
    const { conferenceId, ticketType, notes, dietaryRequirements, specialAssistance } = payload;
    const userId = currentUser.id;

    this.logger.info('Creating registration', { 
      conferenceId, 
      userId, 
      ticketType 
    }); // INFO: start of business operation

    try {
      return await this.transactionManager.runInTransaction(async (tx) => {
        const conference = await this.conferenceRepository.findByIdWithLock(conferenceId, tx);
        if (!conference) {
          this.logger.warn('Conference not found', { conferenceId, userId });
          throw new NotFoundError("Conference not found.");
        }

        if (conference.isPastRegistrationDeadline()) {
          this.logger.warn('Registration deadline passed', { 
            conferenceId, 
            deadline: conference.registrationDeadline 
          });
          throw new BusinessRuleValidationError("Registration for this conference has closed.");
        }

        const isAlreadyRegistered = await this.registrationRepository.existsByConferenceAndUser(conferenceId, userId, tx);
        if (isAlreadyRegistered) {
          this.logger.warn('Duplicate registration attempt', { conferenceId, userId });
          throw new BusinessRuleValidationError("You have already registered for this conference.");
        }

        const registration = Registration.createPending({
          id: this.uuidService.generate(),
          conferenceId,
          userId,
          ticketType: ticketType || 'STANDARD',
          conference, // locked aggregate
          notes,
          dietaryRequirements,
          specialAssistance
        });

        await this.registrationRepository.save(registration, tx);
        await this.conferenceRepository.update(conference, tx);
        await this.outboxRepository.saveMany(registration.pullDomainEvents(), tx);

        this.logger.info('Registration created successfully', { 
          registrationId: registration.id, 
          conferenceId,
          userId,
          ticketType: registration.ticketType
        }); // INFO: business success

        return registration;
      });
    } catch (err) {
      this.logger.error('Failed to create registration', { 
        conferenceId, 
        userId, 
        error: err.message,
        stack: err.stack 
      }); // ERROR: unexpected failure
      throw err; // rethrow for controller
    }
  }
}