/**
 * Domain Event fired immediately after an existing registration aggregate 
 * transition successfully into the 'cancelled' state.
 */
export class RegistrationCancelledEvent {
  /**
   * @param {Object} params
   * @param {string} params.registrationId - Unique identifier of the cancelled registration
   * @param {string} params.conferenceId - Associated conference identifier
   * @param {string} params.userId - Associated attendee user identifier
   * @param {string} [params.reason] - Optional cancellation reason context
   */
  constructor({ registrationId, conferenceId, userId, reason = 'User requested cancellation' }) {
    // 1. Core Event Metadata
    this.eventName = 'registration.cancelled';
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();

    // 2. Event Payload
    this.payload = Object.freeze({
      registrationId,
      conferenceId,
      userId,
      reason
    });

    // Enforce absolute structural immutability
    Object.freeze(this);
  }
}