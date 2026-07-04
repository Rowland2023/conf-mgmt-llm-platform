// domain/errors/PaymentErrors.js
export class DomainError extends Error {
  constructor(message, statusCode = 400, options = {}) {
    super(message, options);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError { 
  constructor(msg, options) { super(msg, 400, options); } 
}
export class UnauthorizedError extends DomainError { 
  constructor(msg, options) { super(msg, 401, options); } 
}
export class ForbiddenError extends DomainError { 
  constructor(msg, options) { super(msg, 403, options); } 
}
export class NotFoundError extends DomainError { 
  constructor(msg, options) { super(msg, 404, options); } 
}
export class ConflictError extends DomainError { 
  constructor(msg, options) { super(msg, 409, options); } 
}
export class UnprocessableEntityError extends DomainError { 
  constructor(msg, options) { super(msg, 422, options); } 
}
export class GatewayError extends DomainError { 
  constructor(msg, options) { super(msg, 502, options); } 
}
export class InternalError extends DomainError { 
  constructor(msg, options) { super(msg, 500, options); } 
}
