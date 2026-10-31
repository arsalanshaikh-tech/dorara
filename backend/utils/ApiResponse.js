'use strict'

const { HTTP_STATUS } = require('../constants')

/**
 * Consistent success envelope for every endpoint:
 *
 *   { success: true, message, data, meta? }
 *
 * `meta` typically carries pagination info. Keeping the shape uniform means the
 * frontend can rely on `res.data` regardless of which endpoint it called.
 */
function sendSuccess(res, { statusCode = HTTP_STATUS.OK, message = 'OK', data = null, meta } = {}) {
  const body = { success: true, message, data }
  if (meta !== undefined) body.meta = meta
  return res.status(statusCode).json(body)
}

function sendCreated(res, { message = 'Created', data = null, meta } = {}) {
  return sendSuccess(res, { statusCode: HTTP_STATUS.CREATED, message, data, meta })
}

function sendNoContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).end()
}

module.exports = { sendSuccess, sendCreated, sendNoContent }
