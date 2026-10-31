'use strict'

const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')
const crypto = require('crypto')
const env = require('../config/env')
const logger = require('../utils/logger')
const ApiError = require('../utils/ApiError')
const { ERROR_CODES } = require('../constants')

/**
 * File storage service.
 * ---------------------
 * Provider-abstracted so the rest of the app never cares where a file lives:
 *   • Cloudinary when its credentials are configured (recommended for prod)
 *   • Local disk (served from /uploads) otherwise — perfect for dev + VPS
 *
 * The interface (`upload`, `destroy`) is intentionally generic so an S3 driver
 * can be added later without touching controllers.
 */

let cloudinary = null
let cloudinaryReady = false

function initCloudinary() {
  if (cloudinaryReady || !env.features.cloudinary) return cloudinaryReady
  try {
    // Optional dependency — only required when Cloudinary is actually used.
    // eslint-disable-next-line global-require
    cloudinary = require('cloudinary').v2
    if (env.CLOUDINARY_URL) {
      // CLOUDINARY_URL is parsed automatically by the SDK.
      cloudinary.config({ secure: true })
    } else {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      })
    }
    cloudinaryReady = true
  } catch (err) {
    logger.warn(`[storage] Cloudinary configured but SDK unavailable: ${err.message}`)
    cloudinaryReady = false
  }
  return cloudinaryReady
}

function uploadDir() {
  return path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR)
}

function extFromMime(mimetype = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
  }
  return map[mimetype] || ''
}

async function uploadToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `dorara/${folder}`, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error)
        resolve({
          provider: 'cloudinary',
          url: result.secure_url,
          key: result.public_id,
          bytes: result.bytes,
          format: result.format,
        })
      },
    )
    stream.end(file.buffer)
  })
}

async function uploadToDisk(file, folder) {
  const dir = path.join(uploadDir(), folder)
  await fs.mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extFromMime(file.mimetype)}`
  const rel = path.posix.join(folder, name)
  await fs.writeFile(path.join(dir, name), file.buffer)
  return {
    provider: 'local',
    url: `${env.API_URL}/uploads/${rel}`,
    key: rel,
    bytes: file.size,
    format: extFromMime(file.mimetype).replace('.', ''),
  }
}

/**
 * Persist an uploaded (in-memory) file and return its public URL + storage key.
 * `folder` groups assets, e.g. "avatars" or "documents".
 */
async function upload(file, folder = 'misc') {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No file provided', { code: ERROR_CODES.UPLOAD_ERROR })
  }
  try {
    if (initCloudinary()) return await uploadToCloudinary(file, folder)
    return await uploadToDisk(file, folder)
  } catch (err) {
    logger.error(`[storage] upload failed: ${err.message}`)
    throw new ApiError(500, 'Failed to store the uploaded file.', {
      code: ERROR_CODES.UPLOAD_ERROR,
      isOperational: false,
    })
  }
}

/** Remove a previously-stored asset by its storage key (best-effort). */
async function destroy(key) {
  if (!key) return
  try {
    if (initCloudinary() && !key.includes('/uploads/') && !fsSync.existsSync(path.join(uploadDir(), key))) {
      await cloudinary.uploader.destroy(key)
      return
    }
    const abs = path.join(uploadDir(), key)
    if (fsSync.existsSync(abs)) await fs.unlink(abs)
  } catch (err) {
    logger.warn(`[storage] failed to delete ${key}: ${err.message}`)
  }
}

module.exports = { upload, destroy, driver: () => (env.features.cloudinary ? 'cloudinary' : 'local') }
