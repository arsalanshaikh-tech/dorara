'use strict'

/**
 * baseSchemaPlugin
 * ----------------
 * A reusable Mongoose plugin applied to (almost) every Dorara model. It gives
 * each collection a consistent shape so new modules can be added without
 * re-deriving these conventions:
 *
 *   • createdAt / updatedAt  — via Mongoose timestamps
 *   • isActive               — soft enable/disable flag
 *   • isDeleted / deletedAt  — soft-delete support (records are never hard-deleted)
 *   • softDelete()/restore() — instance helpers
 *   • query helpers          — `.notDeleted()` and a default filter that hides
 *                              soft-deleted docs from normal reads
 *   • toJSON transform       — maps `_id` -> `id`, strips `__v`
 */

function baseSchemaPlugin(schema, options = {}) {
  const opts = { hideDeleted: true, ...options }

  schema.add({
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  })

  // createdAt / updatedAt managed automatically.
  schema.set('timestamps', true)

  // ----- instance helpers -----
  schema.methods.softDelete = function softDelete() {
    this.isDeleted = true
    this.isActive = false
    this.deletedAt = new Date()
    return this.save()
  }

  schema.methods.restore = function restore() {
    this.isDeleted = false
    this.isActive = true
    this.deletedAt = null
    return this.save()
  }

  // ----- query helpers -----
  schema.query.notDeleted = function notDeleted() {
    return this.where({ isDeleted: false })
  }

  schema.query.onlyDeleted = function onlyDeleted() {
    return this.where({ isDeleted: true })
  }

  // By default, hide soft-deleted docs from find/findOne/count/aggregate.
  if (opts.hideDeleted) {
    const guard = function guard(next) {
      // Allow callers to explicitly opt-in to deleted docs with { withDeleted: true }.
      if (this.getOptions && this.getOptions().withDeleted) return next()
      const filter = this.getFilter ? this.getFilter() : {}
      if (!('isDeleted' in filter)) {
        this.where({ isDeleted: false })
      }
      next()
    }
    schema.pre('find', guard)
    schema.pre('findOne', guard)
    schema.pre('findOneAndUpdate', guard)
    schema.pre('countDocuments', guard)
  }

  // ----- serialization: id instead of _id, drop __v -----
  const transform = (_doc, ret) => {
    ret.id = ret._id ? String(ret._id) : ret.id
    delete ret._id
    delete ret.__v
    return ret
  }
  schema.set('toJSON', { virtuals: true, versionKey: false, transform })
  schema.set('toObject', { virtuals: true, versionKey: false, transform })
}

module.exports = baseSchemaPlugin
