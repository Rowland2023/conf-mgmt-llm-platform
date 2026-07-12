import { AggregateRoot } from './AggregateRoot.js';
import { BusinessRuleValidationError } from '../errors/DomainErrors.js';
import { RegistrationCreatedEvent } from '../events/RegistrationCreatedEvent.js';
import { RegistrationUpdatedEvent } from '../events/RegistrationUpdatedEvent.js';
import { RegistrationConfirmedEvent } from '../events/RegistrationConfirmedEvent.js';
import { RegistrationCancelledEvent } from '../events/RegistrationCancelledEvent.js';
import { AttendeeCheckedInEvent } from '../events/AttendeeCheckedInEvent.js';

export class Registration extends AggregateRoot {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {string} props.conferenceId
   * @param {string} props.userId
   * @param {string} props.status - 'pending' | 'confirmed' | 'cancelled' | 'checked-in'
   * @param {string} props.ticketType
   * @param {string} [props.notes]
   * @param {string} [props.dietaryRequirements]
   * @param {string} [props.specialAssistance]
   * @param {Date} [props.createdAt]
   * @param {Date} [props.updatedAt]
   */
  constructor(props) {
    super(props.id);
    
    this._conferenceId = props.conferenceId;
    this._userId = props.userId;
    this._status = props.status;
    this._ticketType = props.ticketType;
    this._notes = props.notes || '';
    this._dietaryRequirements = props.dietaryRequirements || '';
    this._specialAssistance = props.specialAssistance || '';
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  // --- Getters ---
  get conferenceId() { return this._conferenceId; }
  get userId() { return this._userId; }
  get status() { return this._status; }
  get ticketType() { return this._ticketType; }
  get notes() { return this._notes; }
  get dietaryRequirements() { return this._dietaryRequirements; }
  get specialAssistance() { return this._specialAssistance; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  // --- Named Factory Methods ---
  
  /**
   * Named constructor initialized to a pure, valid 'pending' state.
   * Records a RegistrationCreatedEvent internally.
   */
  static createPending(props) {
    const registration = new Registration({
      ...props,
      status: 'pending'
    });

    registration.addDomainEvent(new RegistrationCreatedEvent({
      registrationId: registration.id,
      conferenceId: registration.conferenceId,
      userId: registration.userId,
      ticketType: registration.ticketType
    }));

    return registration;
  }

  // --- State Machine Transitions & Mutations ---

  /**
   * Mutates peripheral registration properties.
   * Records a RegistrationUpdatedEvent containing only altered parameters.
   */
  updateDetails(updates = {}) {
    if (this._status === 'cancelled') {
      throw new BusinessRuleValidationError("Cannot update registration parameters on a cancelled registration.");
    }

    const updatedFields = {};

    if (updates.ticketType && updates.ticketType !== this._ticketType) {
      updatedFields.ticketType = updates.ticketType;
      this._ticketType = updates.ticketType;
    }
    if (updates.notes !== undefined && updates.notes !== this._notes) {
      updatedFields.notes = updates.notes;
      this._notes = updates.notes;
    }
    if (updates.dietaryRequirements !== undefined && updates.dietaryRequirements !== this._dietaryRequirements) {
      updatedFields.dietaryRequirements = updates.dietaryRequirements;
      this._dietaryRequirements = updates.dietaryRequirements;
    }
    if (updates.specialAssistance !== undefined && updates.specialAssistance !== this._specialAssistance) {
      updatedFields.specialAssistance = updates.specialAssistance;
      this._specialAssistance = updates.specialAssistance;
    }

    // Only queue event if properties actually changed
    if (Object.keys(updatedFields).length > 0) {
      this._updatedAt = new Date();
      this.addDomainEvent(new RegistrationUpdatedEvent({
        registrationId: this.id,
        conferenceId: this._conferenceId,
        userId: this._userId,
        updatedFields
      }));
    }
  }

  /**
   * Confirms registration upon payment processing clearing.
   */
  confirm(paymentId) {
    if (this._status === 'confirmed') return; // Idempotency guard
    if (this._status === 'cancelled') {
      throw new BusinessRuleValidationError("Cannot confirm a cancelled registration.");
    }
    if (this._status === 'checked-in') {
      throw new BusinessRuleValidationError("Cannot confirm a registration that has already checked in.");
    }

    this._status = 'confirmed';
    this._updatedAt = new Date();

    this.addDomainEvent(new RegistrationConfirmedEvent({
      registrationId: this.id,
      conferenceId: this._conferenceId,
      userId: this._userId,
      ticketType: this._ticketType,
      paymentId
    }));
  }

  /**
   * Cancels the registration and frees inventory slots.
   */
  cancel(reason = 'User requested cancellation') {
    if (this._status === 'cancelled') return; // Idempotency guard
    if (this._status === 'checked-in') {
      throw new BusinessRuleValidationError("Cannot cancel a registration once an attendee has checked into the venue.");
    }

    this._status = 'cancelled';
    this._updatedAt = new Date();

    this.addDomainEvent(new RegistrationCancelledEvent({
      registrationId: this.id,
      conferenceId: this._conferenceId,
      userId: this._userId,
      reason
    }));
  }

  /**
   * Marks attendance verification flags at the venue door.
   */
  checkIn() {
    if (this._status === 'checked-in') return; // Idempotency guard
    if (this._status === 'pending') {
      throw new BusinessRuleValidationError("Cannot check in an unconfirmed or unpaid pending registration.");
    }
    if (this._status === 'cancelled') {
      throw new BusinessRuleValidationError("Cannot check in a cancelled registration reference.");
    }

    this._status = 'checked-in';
    this._updatedAt = new Date();

    this.addDomainEvent(new AttendeeCheckedInEvent({
      registrationId: this.id,
      conferenceId: this._conferenceId,
      userId: this._userId,
      checkedInAt: this._updatedAt
    }));
  }
}