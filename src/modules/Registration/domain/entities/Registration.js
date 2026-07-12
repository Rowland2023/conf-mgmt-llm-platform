import { DomainValidationError } from '../errors/DomainErrors.js';
import { RegistrationCancelledEvent, RegistrationConfirmedEvent, AttendeeCheckedInEvent } from '../events/RegistrationEvents.js';

const REGISTRATION_STATUSES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  CHECKED_IN: 'CHECKED_IN'
};

export class Registration {
  constructor({
    id, userId, conferenceId, ticketTier,
    status = REGISTRATION_STATUSES.PENDING,
    attendeeNotes = null,
    version = 1,
    createdAt = new Date(),
    updatedAt = new Date(),
    deletedAt = null
  }) {
    this.id = id;
    this.userId = userId;
    this.conferenceId = conferenceId;
    this.ticketTier = ticketTier;
    this.status = status;
    this.attendeeNotes = attendeeNotes;
    this.version = version;
    this.createdAt = new Date(createdAt);
    this.updatedAt = new Date(updatedAt);
    this.deletedAt = deletedAt ? new Date(deletedAt) : null;
    this._domainEvents = [];
    this._validateInvariants();
  }

  _validateInvariants() {
    if (!this.id) throw new DomainValidationError('Registration must have id');
    if (!this.userId) throw new DomainValidationError('Registration must have userId');
    if (!this.conferenceId) throw new DomainValidationError('Registration must have conferenceId');
    if (!this.ticketTier) throw new DomainValidationError('Registration must have ticketTier');
    if (!Object.values(REGISTRATION_STATUSES).includes(this.status)) {
      throw new DomainValidationError(`Invalid status: ${this.status}`);
    }
    if (this.version < 1) throw new DomainValidationError('Version must be >= 1');
    if (this.attendeeNotes && this.attendeeNotes.length > 1000) {
      throw new DomainValidationError('Attendee notes max 1000 characters');
    }
  }

  _assertNotDeleted() {
    if (this.deletedAt) throw new DomainValidationError('Cannot modify deleted registration');
  }

  static createPending({ id, userId, conferenceId, ticketTier, attendeeNotes = null }) {
    const reg = new Registration({
      id,
      userId,
      conferenceId,
      ticketTier: String(ticketTier || '').trim().toUpperCase(),
      status: REGISTRATION_STATUSES.PENDING,
      attendeeNotes: attendeeNotes?.trim() || null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    reg.addDomainEvent(new RegistrationCreatedEvent({ registrationId: id, userId, conferenceId }));
    return reg;
  }

  updateDetails({ ticketTier, attendeeNotes }) {
    this._assertNotDeleted();
    if (this.isCancelled()) throw new DomainValidationError('Cannot update a cancelled registration');
    if (this.isCheckedIn()) throw new DomainValidationError('Cannot update after check-in');
    
    if (ticketTier !== undefined) this._changeTier(ticketTier);
    if (attendeeNotes !== undefined) this._setAttendeeNotes(attendeeNotes);
    
    this._touch();
  }

  _changeTier(newTier) {
    if (!newTier || typeof newTier !== 'string') {
      throw new DomainValidationError('Ticket tier cannot be empty');
    }
    this.ticketTier = newTier.trim().toUpperCase();
  }

  _setAttendeeNotes(notes) {
    if (notes === null || notes === undefined) {
      this.attendeeNotes = null;
      return;
    }
    if (typeof notes !== 'string') throw new DomainValidationError('Attendee notes must be string');
    if (notes.length > 1000) throw new DomainValidationError('Attendee notes max 1000 characters');
    this.attendeeNotes = notes.trim();
  }

  cancel() {
    this._assertNotDeleted();
    if (this.status === REGISTRATION_STATUSES.CHECKED_IN) {
      throw new DomainValidationError('Cannot cancel after check-in');
    }
    if (this.status === REGISTRATION_STATUSES.CANCELLED) return; // idempotent
    
    this.status = REGISTRATION_STATUSES.CANCELLED;
    this._touch();
    this.addDomainEvent(new RegistrationCancelledEvent({
      registrationId: this.id,
      userId: this.userId,
      conferenceId: this.conferenceId,
      cancelledAt: this.updatedAt
    }));
  }

  confirm() {
    this._assertNotDeleted();
    if (this.status === REGISTRATION_STATUSES.CONFIRMED) return;
    if (this.status !== REGISTRATION_STATUSES.PENDING) {
      throw new DomainValidationError(`Cannot confirm from status ${this.status}`);
    }
    this.status = REGISTRATION_STATUSES.CONFIRMED;
    this._touch();
    this.addDomainEvent(new RegistrationConfirmedEvent({ registrationId: this.id }));
  }

  checkIn() {
    this._assertNotDeleted();
    if (this.status === REGISTRATION_STATUSES.CHECKED_IN) return;
    if (this.status !== REGISTRATION_STATUSES.CONFIRMED) {
      throw new DomainValidationError('Only confirmed registrations can check in');
    }
    this.status = REGISTRATION_STATUSES.CHECKED_IN;
    this._touch();
    this.addDomainEvent(new AttendeeCheckedInEvent({ registrationId: this.id }));
  }

  softDelete() {
    if (this.deletedAt) return;
    this.deletedAt = new Date();
    this._touch();
  }

  _touch() {
    this.updatedAt = new Date();
    this.version++;
  }

  addDomainEvent(event) { this._domainEvents.push(event); }
  pullDomainEvents() {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  isCancelled() { return this.status === REGISTRATION_STATUSES.CANCELLED; }
  isConfirmed() { return this.status === REGISTRATION_STATUSES.CONFIRMED; }
  isCheckedIn() { return this.status === REGISTRATION_STATUSES.CHECKED_IN; }
  isPending() { return this.status === REGISTRATION_STATUSES.PENDING; }
  isActive() { return (this.isConfirmed() || this.isPending()) && !this.deletedAt; }

  static fromPersistence(row) { /* same */ }
  toPersistence() { /* same */ }
}

export { REGISTRATION_STATUSES };