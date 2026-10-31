'use strict'

const path = require('path')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const mongoSanitize = require('express-mongo-sanitize')
const hpp = require('hpp')

const env = require('./config/env')
const logger = require('./utils/logger')
const routes = require('./routes')
const { notFound, errorHandler } = require('./middlewares/error.middleware')
const { globalLimiter } = require('./middlewares/rateLimit.middleware')
const { sendSuccess } = require('./utils/ApiResponse')
const requestId = require('./middlewares/requestId.middleware')
const { buildAllowedOrigins, createOriginHandler } = require('./middlewares/cors.middleware')
const { buildHealth } = require('./services/health.service')
const { mongoose } = require('./config/database')
const { setupSwagger } = require('./docs/swagger')

/**
 * Builds and returns the configured Express application. Kept separate from
 * `server.js` so it can be imported directly in tests without opening a port.
 */
function createApp() {
  const app = express()

  // Behind a load balancer / proxy (Render, Railway, Nginx) — trust it so
  // secure cookies and client IPs (rate limiting) work correctly.
  if (env.TRUST_PROXY) app.set('trust proxy', 1)

  // ----- Request ID (first, so every later log line / error can use it) -----
  app.use(requestId)

  // ----- Security headers -----
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploaded images
    }),
  )

  // ----- CORS (credentialed, to allow httpOnly auth cookies) -----
  const allowedOrigins = buildAllowedOrigins(env)
  app.use(
    cors({
      // Disallowed origins are rejected with a clean 403 (not a 500).
      origin: createOriginHandler(allowedOrigins),
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    }),
  )

  // ----- Body parsing + cookies -----
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use(cookieParser())

  // ----- Hardening: NoSQL injection + HTTP param pollution -----
  app.use(mongoSanitize())
  app.use(hpp())

  // ----- Performance -----
  app.use(compression())

  // ----- Request logging -----
  morgan.token('id', (req) => req.id || '-')
  app.use(
    morgan(
      env.isProd
        ? ':id :remote-addr :method :url :status :res[content-length] - :response-time ms'
        : ':id :method :url :status :response-time ms',
      { stream: logger.stream },
    ),
  )

  // ----- Static: locally-stored uploads (when Cloudinary is not configured) -----
  const uploadPath = path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.join(process.cwd(), env.UPLOAD_DIR)
  app.use('/uploads', express.static(uploadPath))

  // ----- Health check (no rate limit, no auth) -----
  // Reports DB state and which optional providers are configured (booleans only).
  app.get('/health', (_req, res) => {
    const data = buildHealth(mongoose)
    sendSuccess(res, {
      message: data.status === 'ok' ? 'Dorara API is healthy' : 'Dorara API is running (degraded)',
      data,
    })
  })

  // ----- API docs (Swagger UI) -----
  setupSwagger(app)

  // ----- Global rate limiter, then the versioned API -----
  app.use(env.API_PREFIX, globalLimiter, routes)

  // Friendly root.
  app.get('/', (_req, res) =>
    sendSuccess(res, {
      message: 'Dorara Travel API',
      data: { docs: '/docs', health: '/health', base: env.API_PREFIX },
    }),
  )

  // ----- 404 + centralized error handling (must be last) -----
  app.use(notFound)
  app.use(errorHandler)

  return app
}

module.exports = createApp
