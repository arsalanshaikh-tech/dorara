'use strict'

const { body, query, param } = require('express-validator')

const createRequirementRules = [
  body('vertical')
    .notEmpty()
    .withMessage('Vertical is required')
    .isIn(['travel', 'education', 'jobs', 'healthcare', 'business'])
    .withMessage('Invalid vertical'),
  body('answers')
    .notEmpty()
    .withMessage('Answers are required')
    .isObject()
    .withMessage('Answers must be an object'),
]

const updateRequirementRules = [
  body('answers')
    .notEmpty()
    .withMessage('Answers are required')
    .isObject()
    .withMessage('Answers must be an object'),
]

const saveTripBookmarkRules = [
  body('destinationId')
    .notEmpty()
    .withMessage('Destination ID is required'),
  body('recommendationId')
    .optional(),
  body('snapshot')
    .optional()
    .isObject()
    .withMessage('Snapshot must be an object if provided'),
]

const searchDestinationsRules = [
  query('query')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be 1-100 characters'),
  query('tags')
    .optional(),
  query('weather')
    .optional(),
  query('safetyMin')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Safety minimum must be between 0 and 100'),
  query('costMax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost maximum must be a positive number'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
]

module.exports = {
  createRequirementRules,
  updateRequirementRules,
  saveTripBookmarkRules,
  searchDestinationsRules,
}
