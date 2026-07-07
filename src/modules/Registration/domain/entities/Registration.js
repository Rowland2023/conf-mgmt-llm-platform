// src/domain/entities/Registration.js
import { DomainValidationError } from '../errors/DomainErrors.js';

const REGISTRATION_STATUSES = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED', 
  CANCELLED: 'CANCELLED',
  CHECKED_IN: 'CHECKED_IN'
};

export class Registration {
  constructor({
    id,
    userId,
    conferenceId,
    ticketTier,
    status = REGISTRATION_STATUSES.PENDING,
    attendeeNotes = null,
    paymentId = null,
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
    this.paymentId = paymentId;
    this.version = version;
    this.createdAt = new Date(createdAt);
    this.updatedAt = new Date(updatedAt);
    this.deletedAt = deletedAt ? new Date(deletedAt) : null;
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
  }

  static createPending({ id, userId, conferenceId, ticketTier, attendeeNotes = null }) {
    return new Registration({
      id,
      userId,
      conferenceId,
      ticketTier: String(ticketTier || '').trim().toUpperCase(),
      status: REGISTRATION_STATUSES.PENDING,
      attendeeNotes,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  updateDetails({ ticketTier, attendeeNotes }) {
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
    if (this.status === REGISTRATION_STATUSES.CHECKED_IN) {
      throw new DomainValidationError('Cannot cancel after check-in');
    }
    
    // Smooth, clean state transfer transitions
    if (this.status !== REGISTRATION_STATUSES.CANCELLED) {
      this.status = REGISTRATION_STATUSES.CANCELLED;
    }
    this._touch(); // Consistently update modification tracking records on execution
  }

  confirm() {
    if (this.status !== REGISTRATION_STATUSES.PENDING && this.status !== REGISTRATION_STATUSES.CONFIRMED) {
      throw new DomainValidationError(`Cannot confirm from status ${this.status}`);
    }
    if (this.status !== REGISTRATION_STATUSES.CONFIRMED) {
      this.status = REGISTRATION_STATUSES.CONFIRMED;
    }
    this._touch();
  }

  checkIn() {
    if (this.status !== REGISTRATION_STATUSES.CONFIRMED && this.status !== REGISTRATION_STATUSES.CHECKED_IN) {
      throw new DomainValidationError('Only confirmed registrations can check in');
    }
    if (this.status !== REGISTRATION_STATUSES.CHECKED_IN) {
      this.status = REGISTRATION_STATUSES.CHECKED_IN;
    }
    this._touch();
  }

  softDelete() {
    this.deletedAt = new Date();
    this._touch();
  }

  _touch() {
    this.updatedAt = new Date();
  }

  isCancelled() { return this.status === REGISTRATION_STATUSES.CANCELLED; }
  isConfirmed() { return this.status === REGISTRATION_STATUSES.CONFIRMED; }
  isCheckedIn() { return this.status === REGISTRATION_STATUSES.CHECKED_IN; }
  isPending() { return this.status === REGISTRATION_STATUSES.PENDING; }
  isActive() { return (this.isConfirmed() || this.isPending()) && !this.deletedAt; }

  static fromPersistence(row) {
    return new Registration({
      id: row.id,
      userId: row.user_id,
      conferenceId: row.conference_id,
      ticketTier: row.ticket_tier,
      status: row.status,
      attendeeNotes: row.attendee_notes,
      paymentId: row.payment_id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    });
  }

  toPersistence() {
    return {
      id: this.id,
      user_id: this.userId,
      conference_id: this.conferenceId,
      ticket_tier: this.ticketTier,
      status: this.status,
      attendee_notes: this.attendeeNotes,
      payment_id: this.paymentId,
      version: this.version,
      // Protect date instance leakage during DB mapping serialization runs
      created_at: new Date(this.createdAt),
      updated_at: new Date(this.updatedAt),
      deleted_at: this.deletedAt ? new Date(this.deletedAt) : null
    };
  }
}

export { REGISTRATION_STATUSES };