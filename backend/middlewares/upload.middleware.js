'use strict'

const multer = require('multer')
const env = require('../config/env')
const ApiError = require('../utils/ApiError')
const { ERROR_CODES } = require('../constants')

/**
 * Multer configuration for file uploads (profile pictures, passport / visa and
 * travel documents). Files are held in memory and then persisted by the
 * storage service (Cloudinary when configured, otherwise the local disk),
 * keeping the transport layer independent of the storage backend.
 */

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function makeUploader(allowedTypes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) return cb(null, true)
      cb(
        new ApiError(400, `Unsupported file type: ${file.mimetype}`, {
          code: ERROR_CODES.UPLOAD_ERROR,
        }),
      )
    },
  })
}

const uploadImage = makeUploader(IMAGE_TYPES)
const uploadDocument = makeUploader(DOC_TYPES)

module.exports = {
  // Profile photo (single image).
  avatar: uploadImage.single('avatar'),
  // Generic single document (passport, visa, travel doc).
  document: uploadDocument.single('document'),
  // Multiple documents at once.
  documents: uploadDocument.array('documents', 6),
  uploadImage,
  uploadDocument,
}
