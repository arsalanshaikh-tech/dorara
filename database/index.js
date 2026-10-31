'use strict'

/**
 * Public entry point for the Dorara database layer.
 *
 * Express bootstrap example:
 *
 *   const { connectDB, models } = require('./database')
 *   await connectDB()
 *   const user = await models.User.findOne({ email })
 */

const { connectDB, disconnectDB, mongoose } = require('./config/db')
const env = require('./config/env')
const models = require('./models')

module.exports = {
  connectDB,
  disconnectDB,
  mongoose,
  env,
  models,
  ...models, // also expose each model at the top level for convenience
}
