'use strict'

const nodemailer = require('nodemailer')
const env = require('../config/env')
const logger = require('../utils/logger')
const templates = require('../helpers/emailTemplates')

/**
 * Email service (Nodemailer).
 * ---------------------------
 * Key-gated: when SMTP credentials are configured the mailer sends real email;
 * otherwise it degrades gracefully by logging the message (and, in dev, the
 * action link) so local development and preview deploys never crash on a
 * missing SMTP provider. Business logic (auth flows) does not change either way.
 */

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!env.features.email) return null

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return transporter
}

async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter()

  if (!tx) {
    // Graceful fallback — no SMTP configured.
    logger.warn(`[email] SMTP not configured. Skipping send to ${to}: "${subject}"`)
    if (!env.isProd && text) logger.debug(`[email] (dev) body for ${to}:\n${text}`)
    return { delivered: false, reason: 'SMTP_NOT_CONFIGURED' }
  }

  try {
    const info = await tx.sendMail({ from: env.EMAIL_FROM, to, subject, html, text })
    logger.info(`[email] sent "${subject}" to ${to} (${info.messageId})`)
    return { delivered: true, messageId: info.messageId }
  } catch (err) {
    // Never let a mail failure break the primary flow (e.g. registration).
    logger.error(`[email] failed to send "${subject}" to ${to}: ${err.message}`)
    return { delivered: false, reason: err.message }
  }
}

// ----- High-level, template-backed senders -----

function sendVerificationEmail(to, { name, url }) {
  return sendMail({ to, ...templates.verifyEmail({ name, url }) })
}

function sendWelcomeEmail(to, { name }) {
  return sendMail({ to, ...templates.welcome({ name }) })
}

function sendPasswordResetEmail(to, { name, url }) {
  return sendMail({ to, ...templates.resetPassword({ name, url }) })
}

function sendOtpEmail(to, { name, code, minutes }) {
  return sendMail({ to, ...templates.otp({ name, code, minutes }) })
}

function sendLoginAlertEmail(to, { name, device, ip, when }) {
  return sendMail({ to, ...templates.loginAlert({ name, device, ip, when }) })
}

async function verifyConnection() {
  const tx = getTransporter()
  if (!tx) return false
  try {
    await tx.verify()
    return true
  } catch {
    return false
  }
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOtpEmail,
  sendLoginAlertEmail,
  verifyConnection,
}
