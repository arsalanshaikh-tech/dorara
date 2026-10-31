'use strict'

const mongoose = require('mongoose')
const baseSchemaPlugin = require('./plugins/baseSchema')

const { Schema } = mongoose

/**
 * Questionnaire
 * -------------
 * Data-driven definition of the multi-step form that powers the
 * QuestionnaireEngine on the frontend. Storing this in the DB (rather than
 * hard-coding it) is what makes Dorara modular: adding Education / Healthcare /
 * Jobs / Business later is just inserting a new questionnaire document with a
 * different `vertical` — no schema changes required.
 *
 * The `question` sub-schema is a 1:1 mirror of the frontend `Question` type.
 */

const questionValidationSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    minValue: { type: Number, default: null },
    maxValue: { type: Number, default: null },
    minSelected: { type: Number, default: null },
    maxLength: { type: Number, default: null },
  },
  { _id: false },
)

const scaleSchema = new Schema(
  {
    minLabel: { type: String, required: true },
    maxLabel: { type: String, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
)

const questionSchema = new Schema(
  {
    // Stable key used as the answer map key (e.g. "budget", "interest_type").
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'single_choice_or_text',
        'range_currency',
        'date_range',
        'single_choice',
        'multi_choice',
        'scale',
        'multi_text',
        'long_text',
      ],
    },
    label: { type: String, required: true },
    help: { type: String, default: '' },
    options: { type: [String], default: undefined },
    fields: { type: [String], default: undefined },
    scale: { type: scaleSchema, default: undefined },
    validation: { type: questionValidationSchema, default: () => ({}) },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

const questionnaireSchema = new Schema(
  {
    // "travel" | "education" | "healthcare" | "work" | "business" | ...
    vertical: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    // Enables safe evolution of a questionnaire without breaking old answers.
    version: { type: Number, default: 1 },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    submitLabel: { type: String, default: 'Submit' },
    steps: {
      type: [questionSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A questionnaire must contain at least one step',
      },
    },
    // Only one questionnaire per vertical should be live at a time.
    isPublished: { type: Boolean, default: true, index: true },
  },
  { collection: 'questionnaires' },
)

questionnaireSchema.plugin(baseSchemaPlugin)

// One published version per vertical + version number.
questionnaireSchema.index({ vertical: 1, version: 1 }, { unique: true })

module.exports =
  mongoose.models.Questionnaire || mongoose.model('Questionnaire', questionnaireSchema)
