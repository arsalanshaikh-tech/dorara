'use strict'

const mongoose = require('mongoose')
const env = require('./env')

/**
 * MongoDB connection manager.
 *
 * Uses a cached connection so that in serverless / hot-reload environments we
 * never open more than one pool. In a long-running Express server `connectDB`
 * is simply awaited once during bootstrap.
 */

// Fail fast on undefined fields being written — protects data integrity.
mongoose.set('strictQuery', true)

let cached = global.__doraraMongoose
if (!cached) {
  cached = global.__doraraMongoose = { conn: null, promise: null }
}

async function connectDB(uri = env.MONGODB_URI) {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    const options = {
      dbName: env.DB_NAME,
      // Sensible pool + timeout defaults for production.
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      autoIndex: env.NODE_ENV !== 'production', // build indexes in dev; manage explicitly in prod
    }

    cached.promise = mongoose.connect(uri, options).then((m) => {
      // Ensure every registered model is loaded so indexes are known.
      require('../models')
      return m
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    cached.promise = null
    throw err
  }

  return cached.conn
}

async function disconnectDB() {
  if (cached.conn) {
    await mongoose.disconnect()
    cached.conn = null
    cached.promise = null
  }
}

// Helpful connection lifecycle logging.
mongoose.connection.on('connected', () => {
  console.log(`[dorara-db] connected to "${env.DB_NAME}"`)
})
mongoose.connection.on('error', (err) => {
  console.error('[dorara-db] connection error:', err.message)
})
mongoose.connection.on('disconnected', () => {
  console.log('[dorara-db] disconnected')
})

module.exports = { connectDB, disconnectDB, mongoose }
