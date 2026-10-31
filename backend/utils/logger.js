'use strict'

const fs = require('fs')
const path = require('path')
const env = require('../config/env')

/**
 * Lightweight, dependency-free logger.
 *
 * - Writes leveled, timestamped lines to stdout/stderr (captured by Render,
 *   Railway, Docker, PM2, etc.).
 * - Also appends error + combined logs to files under LOG_DIR so a VPS
 *   deployment has durable logs without extra infrastructure.
 *
 * A heavier logger (winston/pino) can be swapped in later without touching call
 * sites, since everything goes through this single module.
 */

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 }
const activeLevel = LEVELS[env.LOG_LEVEL] ?? LEVELS.info

const logDir = path.isAbsolute(env.LOG_DIR) ? env.LOG_DIR : path.join(process.cwd(), env.LOG_DIR)

let fileLoggingEnabled = true
try {
  fs.mkdirSync(logDir, { recursive: true })
} catch {
  // Read-only filesystem (some serverless hosts) — fall back to console only.
  fileLoggingEnabled = false
}

function appendToFile(fileName, line) {
  if (!fileLoggingEnabled) return
  fs.appendFile(path.join(logDir, fileName), line + '\n', () => {})
}

function format(level, message, meta) {
  const time = new Date().toISOString()
  let base = `${time} [${level.toUpperCase()}] ${message}`
  if (meta !== undefined) {
    try {
      base += ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`
    } catch {
      base += ' [unserializable meta]'
    }
  }
  return base
}

function log(level, message, meta) {
  if (LEVELS[level] > activeLevel) return
  const line = format(level, message, meta)

  if (level === 'error') {
    console.error(line)
    appendToFile('error.log', line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
  appendToFile('combined.log', line)
}

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  http: (message, meta) => log('http', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  // Morgan stream adapter.
  stream: {
    write: (message) => log('http', message.trim()),
  },
}

module.exports = logger
