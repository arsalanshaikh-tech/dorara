'use strict'

const { validationResult } = require('express-validator')
const ApiError = require('../utils/ApiError')

/**
 * Runs a set of express-validator chains, then collects the results. If any
 * validation failed, it throws a single structured 422 ApiError listing every
 * offending field — never trusting the frontend's own validation.
 *
 *   router.post('/login', validate(loginRules), controller.login)
 */
function validate(validations = []) {
  return async function runValidations(req, _res, next) {
    await Promise.all(validations.map((validation) => validation.run(req)))

    const result = validationResult(req)
    if (result.isEmpty()) return next()

    const details = result.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }))

    return next(ApiError.validation('Please correct the highlighted fields.', details))
  }
}

module.exports = validate
