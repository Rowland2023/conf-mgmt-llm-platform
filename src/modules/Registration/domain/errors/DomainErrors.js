export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DomainValidationError extends DomainError {}

export class BusinessRuleValidationError extends DomainError {}

export class NotFoundError extends DomainError {}

export class UnauthorizedError extends DomainError {}

export class ConcurrencyConflictError extends DomainError {}