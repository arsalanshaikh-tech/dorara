'use strict'

const env = require('./config/env')
const logger = require('./utils/logger')
const createApp = require('./app')
const { connectDB, disconnectDB, models } = require('./config/database')
const { logProviderStatus } = require('./config/providers')
const { ensureTripPlannerIndexes } = require('./config/ensureIndexes')

/**
 * Process entry point. Connects to MongoDB first (fail fast if unreachable),
 * then starts the HTTP server. Registers graceful-shutdown + last-resort crash
 * handlers so the process exits cleanly on SIGINT/SIGTERM and on unexpected
 * fatal errors.
 */

let server

async function start() {
  try {
    await connectDB()
    logger.info(`[dorara-backend] MongoDB connected (${env.DB_NAME})`)

    // autoIndex is off in production, so build the trip-planner indexes explicitly.
    await ensureTripPlannerIndexes(models)
    logProviderStatus(logger)

    const app = createApp()
    server = app.listen(env.PORT, () => {
      logger.info(`[dorara-backend] listening on port ${env.PORT} (${env.NODE_ENV})`)
      logger.info(`[dorara-backend] API base: ${env.API_URL}${env.API_PREFIX}`)
    })
  } catch (err) {
    logger.error('[dorara-backend] failed to start', { message: err.message })
    process.exit(1)
  }
}

async function shutdown(signal) {
  logger.info(`[dorara-backend] ${signal} received — shutting down gracefully`)
  try {
    if (server) await new Promise((resolve) => server.close(resolve))
    await disconnectDB()
    logger.info('[dorara-backend] shutdown complete')
    process.exit(0)
  } catch (err) {
    logger.error('[dorara-backend] error during shutdown', { message: err.message })
    process.exit(1)
  }
}

;['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => shutdown(signal))
})

process.on('unhandledRejection', (reason) => {
  logger.error('[dorara-backend] unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
  })
})

process.on('uncaughtException', (err) => {
  logger.error('[dorara-backend] uncaught exception', { message: err.message, stack: err.stack })
  // Uncaught exceptions leave the process in an undefined state — exit.
  shutdown('uncaughtException')
})

start()

module.exports = { start }
