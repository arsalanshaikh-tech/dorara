'use strict'

const mongoose = require('mongoose')

const { Schema } = mongoose

/**
 * AIGenerationLog
 * ---------------
 * Lightweight cost / reliability log for trip-planner AI calls. Deliberately
 * stores NO prompt or response text and no personal data: only the outcome,
 * latency, model and token counts (when the SDK reports them). Entries expire
 * after 90 days.
 */
const aiGenerationLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    requestId: { type: String, default: '' },
    type: { type: String, enum: ['trip_plan', 'adjust'], required: true },
    model: { type: String, default: '' },
    success: { type: Boolean, required: true },
    // ok = valid first try, repaired = valid after repair/retry,
    // fallback = deterministic content used, disabled = no AI key configured.
    outcome: {
      type: String,
      enum: ['ok', 'repaired', 'fallback', 'timeout', 'rate_limited', 'error', 'disabled'],
      required: true,
    },
    latencyMs: { type: Number, default: 0 },
    inputTokens: { type: Number, default: null },
    outputTokens: { type: Number, default: null },
    errorCode: { type: String, default: '' },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  },
  { collection: 'ai_generation_logs', timestamps: { createdAt: true, updatedAt: false } },
)

aiGenerationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
aiGenerationLogSchema.index({ createdAt: -1 })

module.exports =
  mongoose.models.AIGenerationLog || mongoose.model('AIGenerationLog', aiGenerationLogSchema)
