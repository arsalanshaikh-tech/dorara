'use strict'

/**
 * Query helpers for pagination, sorting and safe field selection — shared by
 * every list endpoint so behaviour (and response `meta`) is uniform.
 */

/** Parse `page`/`limit` query params into safe, bounded numbers. */
function getPagination(query = {}, { defaultLimit = 12, maxLimit = 100 } = {}) {
  let page = Number.parseInt(query.page, 10)
  let limit = Number.parseInt(query.limit, 10)

  if (Number.isNaN(page) || page < 1) page = 1
  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/** Build a paginated `meta` object for the response envelope. */
function buildMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Translate a `sort` query string like "-createdAt,name" into a Mongoose sort
 * object, restricted to an allow-list of sortable fields.
 */
function getSort(sortParam, allowedFields = [], fallback = { createdAt: -1 }) {
  if (!sortParam || typeof sortParam !== 'string') return fallback
  const sort = {}
  for (const raw of sortParam.split(',')) {
    const token = raw.trim()
    if (!token) continue
    const desc = token.startsWith('-')
    const field = desc ? token.slice(1) : token
    if (allowedFields.length === 0 || allowedFields.includes(field)) {
      sort[field] = desc ? -1 : 1
    }
  }
  return Object.keys(sort).length ? sort : fallback
}

module.exports = { getPagination, buildMeta, getSort }
