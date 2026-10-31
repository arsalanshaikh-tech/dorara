'use strict'

const { HTTP_STATUS, ERROR_CODES } = require('../constants')

/**
 * ApiError
 * --------
 * A single, structured error type used across the whole backend. Controllers
 * and services throw these; the centralized error handler serializes them into
 * a consistent JSON envelope. `isOperational` distinguishes expected,
 * client-facing errors from unexpected programmer errors.
 */
class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode || HTTP_STATUS.INTERNAL
    this.code = options.code || ERROR_CODES.INTERNAL
    this.details = options.details // e.g. express-validator field errors
    this.isOperational = options.isOperational !== false
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, {
      code: ERROR_CODES.VALIDATION_ERROR,
      ...options,
    })
  }

  static validation(message = 'Validation failed', details) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE, message, {
      code: ERROR_CODES.VALIDATION_ERROR,
      details,
    })
  }

  static unauthorized(message = 'Authentication required', options) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, {
      code: ERROR_CODES.UNAUTHENTICATED,
      ...options,
    })
  }

  static forbidden(message = 'You do not have permission to do that', options) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, {
      code: ERROR_CODES.FORBIDDEN,
      ...options,
    })
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, {
      code: ERROR_CODES.NOT_FOUND,
      ...options,
    })
  }

  static conflict(message = 'Resource already exists', options) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, options)
  }

  static tooMany(message = 'Too many requests', options) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, {
      code: ERROR_CODES.RATE_LIMITED,
      ...options,
    })
  }

  static internal(message = 'Something went wrong', options) {
    return new ApiError(HTTP_STATUS.INTERNAL, message, {
      code: ERROR_CODES.INTERNAL,
      isOperational: false,
      ...options,
    })
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', options) {
    return new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, message, {
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      ...options,
    })
  }
}

module.exports = ApiError
