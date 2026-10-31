'use strict'

/**
 * asyncHandler
 * ------------
 * Wraps an async Express handler so any thrown error / rejected promise is
 * forwarded to `next()` and handled by the centralized error middleware. This
 * removes the need for a try/catch in every controller.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = asyncHandler
