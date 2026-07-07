// src/application/use-cases/GetRegistrationUseCase.js
import { NotFoundError, UnauthorizedError } from '../../domain/errors/DomainErrors.js';

export class GetRegistrationUseCase {
  constructor({ registrationRepository, conferenceRepository }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository; 
  }

  async execute({ registrationId } = {}, currentUser) {
    // 1. Defend Input Integrity (Should preferably be intercepted by DTO validation, but great as an internal guard)
    if (!registrationId) {
      throw new NotFoundError("Registration identifier is required.");
    }

    // 2. Fetch the target entity
    const registration = await this.registrationRepository.findById(registrationId);
    if (!registration) {
      throw new NotFoundError("Registration not found.");
    }

    // 3. Enforce Multi-Tenancy Isolation Guardrails (BOLA Protection)
    if (!currentUser.isAdmin()) {

      // Tenant Validation: Attendee Isolation
      if (currentUser.isAttendee()) {
        if (registration.userId !== currentUser.id) {
          // UPGRADED: Throwing a NotFoundError here hides the existence of another user's data completely.
          // The attacker gets a 404 whether the random ID they guessed exists or not.
          throw new NotFoundError("Registration not found.");
        }
      }

      // Tenant Validation: Organizer Isolation
      else if (currentUser.isOrganizer()) {
        const isOwner = await this.conferenceRepository.isOrganizerOf(
          registration.conferenceId, 
          currentUser.id
        );
        
        if (!isOwner) {
          // UPGRADED: Organizers are highly technical actors. Throwing a 403 here is appropriate 
          // because they are explicitly trying to cross an event domain barrier.
          throw new UnauthorizedError("Unauthorized: This registration belongs to an unmanaged event.");
        }
      }

      else {
        throw new UnauthorizedError("Unauthorized: Invalid execution context authorization.");
      }
    }

    // 4. Return Data State Safely
    return {
      success: true,
      registration
    };
  }
}