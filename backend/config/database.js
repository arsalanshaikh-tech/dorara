'use strict'

/**
 * Database bridge.
 *
 * The Mongoose connection manager and all models already live in the shared
 * `database/` package at the repo root (one source of truth for both the
 * frontend's data layer and this backend). We simply re-export them so the rest
 * of the backend imports models from a single local path:
 *
 *     const { models } = require('../config/database')
 *     const user = await models.User.findById(id)
 */

const path = require('path')

// Resolve the sibling `database` package (../../database from backend/config).
// eslint-disable-next-line import/no-dynamic-require, global-require
const db = require(path.join(__dirname, '..', '..', 'database'))

module.exports = {
  connectDB: db.connectDB,
  disconnectDB: db.disconnectDB,
  mongoose: db.mongoose,
  models: db.models,
}
