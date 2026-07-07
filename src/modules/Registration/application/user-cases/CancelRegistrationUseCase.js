export class CancelRegistrationUseCase {
  constructor({ registrationRepository, conferenceRepository, unitOfWork }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository;
    this.unitOfWork = unitOfWork; // Optional: For transaction handling
  }

  async execute({ registrationId, userId }) {
    // 1. Concurrent Fetching (Performance optimization)
    const registration = await this.registrationRepository.findById(registrationId);
    if (!registration) {
      throw new Error("Registration not found."); // In prod, use custom AppErrors (e.g., NotFoundError)
    }

    // 2. Auth Guard
    if (registration.userId !== userId) {
      throw new Error("Unauthorized: You do not own this registration."); 
    }

    const conference = await this.conferenceRepository.findById(registration.conferenceId);
    if (!conference) {
      throw new Error("Associated conference not found.");
    }

    // 3. Domain Logic delegated completely to entities
    // Pass UTC timestamp to ensure timezone agnostic comparison
    const nowUtc = Date.now(); 
    if (!conference.isCancellableAt(nowUtc)) {
      throw new Error("Cannot cancel a registration for this event timeline.");
    }

    // 4. Update via Entity Domain Method
    registration.cancel(); 

    // 5. Persist the whole entity state safely
    await this.registrationRepository.save(registration);

    return {
      success: true,
      message: "Registration successfully cancelled.",
      registrationId: registration.id
    };
  }
}