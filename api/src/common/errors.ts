/**
 * Domain error base. Anything thrown as a DomainError is mapped to a 400-class
 * response by the exception filter; everything else is a 500.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}
