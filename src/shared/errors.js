'use strict';

/** Typed application errors mapped to HTTP status codes by the HTTP adapter. */
class AppError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const errors = {
  validation: (msg, details) => new AppError('VALIDATION_FAILED', msg, 400, details),
  unauthenticated: (msg = 'Authentication required') => new AppError('UNAUTHENTICATED', msg, 401),
  forbidden: (msg = 'Not allowed') => new AppError('FORBIDDEN', msg, 403),
  notFound: (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`, 404),
  conflict: (msg, details) => new AppError('CONFLICT', msg, 409, details),
  rule: (msg, details) => new AppError('BUSINESS_RULE_VIOLATION', msg, 422, details),
  tooMany: (msg = 'Too many requests') => new AppError('RATE_LIMITED', msg, 429),
  locked: (msg = 'Account temporarily locked') => new AppError('ACCOUNT_LOCKED', msg, 423),
  upstream: (msg = 'Upstream service unavailable') => new AppError('UPSTREAM_UNAVAILABLE', msg, 503),
};

module.exports = { AppError, errors };
