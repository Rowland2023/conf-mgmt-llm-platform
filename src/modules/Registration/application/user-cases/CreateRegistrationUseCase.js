// src/application/use-cases/CreateRegistrationUseCase.js
import { NotFoundError, BusinessRuleValidationError } from '../../domain/errors/DomainErrors.js';
import { Registration } from '../../domain/entities/Registration.js';

export class CreateRegistrationUseCase {
  constructor({ registrationRepository, conferenceRepository, uuidService, transactionManager }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository;
    this.uuidService = uuidService;
    this.transactionManager = transactionManager; // Injected to manage safe database boundaries
  }

  async execute({ conferenceId, userId, ticketTier = 'STANDARD' }) {
    // Execute everything within an isolated database transaction block
    return await this.transactionManager.runInTransaction(async (tx) => {
      
      // 1. Fetch conference with a lock (Row-level locking for concurrency protection)
      const conference = await this.conferenceRepository.findByIdWithLock(conferenceId, tx);
      if (!conference) {
        throw new NotFoundError("The target conference does not exist.");
      }

      // 2. Structural domain checking
      if (conference.isPastRegistrationDeadline()) {
        throw new BusinessRuleValidationError("Registration for this conference has closed.");
      }

      // 3. Double Booking Guard (Backed by a unique DB index)
      const isAlreadyRegistered = await this.registrationRepository.existsByConferenceAndUser(conferenceId, userId, tx);
      if (isAlreadyRegistered) {
        throw new BusinessRuleValidationError("You have already registered for this conference.");
      }

      // 4. Safe Capacity Check (Since row is locked, count won't fluctuate mid-flight)
      const currentAttendeeCount = await this.registrationRepository.countActiveRegistrations(conferenceId, tx);
      if (conference.isFullyBooked(currentAttendeeCount)) {
        throw new BusinessRuleValidationError("This conference is sold out.");
      }

      // 5. Create Domain Entity through a domain factory method
      const registrationId = this.uuidService.generate();
      const registration = Registration.createPending({
        id: registrationId,
        conferenceId,
        userId,
        ticketTier
      });

      // 6. Safe Persist within transaction scope
      await this.registrationRepository.save(registration, tx);

      return {
        success: true,
        message: "Registration initialized successfully.",
        registrationId: registration.id,
        status: registration.status
      };
    });
  }
}