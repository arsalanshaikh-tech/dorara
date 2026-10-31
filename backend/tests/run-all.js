'use strict'

/**
 * Loads every tests/*.test.js file into one `node:test` run. Used instead of
 * `node --test tests/` because that form fails on Node >= 22 (it treats the
 * directory as a module), and bare `node --test` would also pick up
 * scripts/smoke-test.js (which needs an in-memory MongoDB).
 */
const fs = require('fs')
const path = require('path')

fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .forEach((f) => require(path.join(__dirname, f)))
