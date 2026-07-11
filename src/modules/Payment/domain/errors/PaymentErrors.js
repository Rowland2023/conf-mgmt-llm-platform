// domain/errors/PaymentErrors.js

export class DomainError extends Error {
  constructor(message, statusCode = 400, options = {}) {
    // Standardize error cause stitching across modern runtimes
    super(message, options);
    
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.isOperational = true;
    
    if (options.cause) {
      this.cause = options.cause;
    }
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 400, options); 
    this.name = "ValidationError";
  } 
}

export class UnauthorizedError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 401, options); 
    this.name = "UnauthorizedError";
  } 
}

export class ForbiddenError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 403, options); 
    this.name = "ForbiddenError";
  } 
}

export class NotFoundError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 404, options); 
    this.name = "NotFoundError";
  } 
}

export class ConflictError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 409, options); 
    this.name = "ConflictError";
  } 
}

export class UnprocessableEntityError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 422, options); 
    this.name = "UnprocessableEntityError";
  } 
}

export class GatewayError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 502, options); 
    this.name = "GatewayError";
  } 
}

export class InternalError extends DomainError { 
  constructor(msg, options = {}) { 
    super(msg, 500, options); 
    this.name = "InternalError";
  } 
}