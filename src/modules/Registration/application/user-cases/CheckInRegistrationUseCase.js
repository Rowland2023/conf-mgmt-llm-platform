// src/application/use-cases/CheckInRegistrationUseCase.js
import { NotFoundError, UnauthorizedError } from '../../domain/errors/DomainErrors.js';

export class CheckInRegistrationUseCase {
  constructor({ registrationRepository, conferenceRepository }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository;
  }

  async execute({ registrationId, organizerId }) {
    // 1. Fetch registration
    const registration = await this.registrationRepository.findById(registrationId);
    if (!registration) {
      throw new NotFoundError("Registration not found."); 
    }

    // 2. Security Guard
    const conference = await this.conferenceRepository.findById(registration.conferenceId);
    if (!conference) {
      throw new NotFoundError("Associated conference not found.");
    }

    if (!conference.isOrganizer(organizerId)) {
      throw new UnauthorizedError("Unauthorized: Only event organizers can check-in attendees."); 
    }

    // 3 & 4. True Delegation to the Domain Entity State Machine
    // Let the entity's internal checkIn() method validate its own state transitions.
    // If it is already checked in or cancelled, the entity throws the BusinessRuleValidationError.
    registration.checkIn();

    // 5. Atomic Persistence
    await this.registrationRepository.save(registration);

    return {
      success: true,
      message: "Check-in successful.",
      attendeeId: registration.userId,
      checkedInAt: registration.checkedInAt
    };
  }
}