// src/application/use-cases/UpdateRegistrationUseCase.js
import { NotFoundError, UnauthorizedError, BusinessRuleValidationError } from '../../domain/errors/DomainErrors.js';

export class UpdateRegistrationUseCase {
  constructor({ registrationRepository, conferenceRepository, transactionManager }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository;
    this.transactionManager = transactionManager; // To manage capacity checks and modifications atomically
  }

  async execute({ registrationId, ticketTier, attendeeNotes } = {}, currentUser) {
    // 1. Structural Layer Input Defense
    if (!registrationId) {
      throw new NotFoundError("Registration identifier is required.");
    }

    // 2. Wrap execution inside a transaction block to handle concurrent multi-table state updates
    return await this.transactionManager.runInTransaction(async (tx) => {
      
      // 3. Fetch the target entity
      const registration = await this.registrationRepository.findById(registrationId, tx);
      if (!registration) {
        throw new NotFoundError("Registration not found."); // Obfuscates existence for bad actors
      }

      // 4. Enforce Contextual Authorization Guards (BOLA Protection)
      if (!currentUser.isAdmin()) {
        if (currentUser.isAttendee()) {
          if (registration.userId !== currentUser.id) {
            throw new NotFoundError("Registration not found."); // Maintain 404 blind-wall security strategy
          }
          
          // Attendee Mutation Constraints: Attendees cannot arbitrarily upgrade tiers without paying/checking parameters
          if (ticketTier && ticketTier !== registration.ticketTier) {
            throw new UnauthorizedError("Unauthorized: Attendees cannot directly modify ticket tiers. Please use the upgrade workflow.");
          }
        } 
        
        else if (currentUser.isOrganizer()) {
          const isOwner = await this.conferenceRepository.isOrganizerOf(registration.conferenceId, currentUser.id, tx);
          if (!isOwner) {
            throw new UnauthorizedError("Unauthorized: This registration belongs to an unmanaged event.");
          }
        } 
        
        else {
          throw new UnauthorizedError("Unauthorized: Invalid execution context authorization.");
        }
      }

      // 5. Fetch associated conference if domain logic rules are impacted (like changing capacity)
      const conference = await this.conferenceRepository.findByIdWithLock(registration.conferenceId, tx);
      if (!conference) {
        throw new NotFoundError("Associated conference not found.");
      }

      // Guard Rail: Prevent updates to historical, locked down data
      if (conference.isPastRegistrationDeadline()) {
        throw new BusinessRuleValidationError("This event lifecycle is closed. Modifications are disabled.");
      }

      // 6. Evaluate Tier Capacity Shifts under Concurrency Restraints
      // If an Organizer or Admin is upgrading/changing the tier, verify the new tier isn't sold out
      if (ticketTier && ticketTier !== registration.ticketTier) {
        const currentTierCount = await this.registrationRepository.countActiveRegistrationsByTier(registration.conferenceId, ticketTier, tx);
        
        if (conference.isTierFullyBooked(ticketTier, currentTierCount)) {
          throw new BusinessRuleValidationError(`The targeted ticket tier [${ticketTier}] is sold out.`);
        }
      }

      // 7. Delegate Mutation Execution straight to the Domain Entity State Machine
      // This protects entity invariants (e.g., enforcing valid tiers, validation structures)
      registration.updateDetails({
        ticketTier,
        attendeeNotes
      });

      // 8. Atomic Persistence of complete mutated entity state
      await this.registrationRepository.save(registration, tx);

      return {
        success: true,
        message: "Registration updated successfully.",
        registrationId: registration.id,
        updatedFields: {
          ticketTier: registration.ticketTier,
          attendeeNotes: registration.attendeeNotes
        }
      };
    });
  }
}