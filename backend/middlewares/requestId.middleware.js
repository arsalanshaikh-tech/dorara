'use strict'

const crypto = require('crypto')

/**
 * Request ID middleware.
 *
 * Gives every request a stable id (`req.id`), echoes it in the `X-Request-Id`
 * response header and lets log lines be correlated across the proxy, the API
 * and the error handler. An incoming `X-Request-Id` is reused only if it looks
 * safe (short, alphanumeric), otherwise a fresh UUID is generated — so a client
 * can never inject arbitrary text into logs or headers.
 */
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id']
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID()
  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}

module.exports = requestId
