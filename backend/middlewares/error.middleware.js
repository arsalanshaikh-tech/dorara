'use strict'

const ApiError = require('../utils/ApiError')
const logger = require('../utils/logger')
const env = require('../config/env')
const { HTTP_STATUS, ERROR_CODES } = require('../constants')

/**
 * 404 handler — any request that reached here matched no route.
 */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))
}

/**
 * Normalizes common non-ApiError errors (Mongoose, JWT, Multer) into ApiError.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err

  // Mongoose bad ObjectId.
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`)
  }

  // Mongoose duplicate key.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    const code = field === 'email' ? ERROR_CODES.EMAIL_TAKEN : ERROR_CODES.VALIDATION_ERROR
    return ApiError.conflict(`An account with this ${field} already exists.`, { code })
  }

  // Mongoose validation.
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }))
    return ApiError.validation('Validation failed', details)
  }

  // JWT.
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid authentication token', { code: ERROR_CODES.INVALID_TOKEN })
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Your session has expired. Please sign in again.', {
      code: ERROR_CODES.INVALID_TOKEN,
    })
  }

  // Multer upload errors.
  if (err.name === 'MulterError') {
    return ApiError.badRequest(err.message, { code: ERROR_CODES.UPLOAD_ERROR })
  }

  // JSON body parse error.
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON in request body')
  }

  // Unknown — treat as internal.
  return ApiError.internal(err.message)
}

/**
 * Centralized error handler. Serializes every error into the uniform envelope:
 *   { success: false, error: { code, message, details? } }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const apiError = normalizeError(err)

  if (!apiError.isOperational || apiError.statusCode >= HTTP_STATUS.INTERNAL) {
    logger.error(`[${req.id || '-'}] ${req.method} ${req.originalUrl} -> ${apiError.message}`, {
      stack: env.isProd ? undefined : err.stack,
    })
  } else {
    logger.warn(`[${req.id || '-'}] ${req.method} ${req.originalUrl} -> ${apiError.statusCode} ${apiError.message}`)
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  }
  if (apiError.details) body.error.details = apiError.details
  if (!env.isProd && !apiError.isOperational) body.error.stack = err.stack

  res.status(apiError.statusCode).json(body)
}

module.exports = { notFound, errorHandler }
