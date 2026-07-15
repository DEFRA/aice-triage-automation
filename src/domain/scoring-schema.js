/**
 * Scoring result schemas for model output (Zod) and service boundary validation (Joi).
 */
import Joi from 'joi'
import { z } from 'zod'

import { CRITERION_KEYS, RAG_VALUES, ROUTING_VALUES } from '#/domain/rubric.js'

/**
 * @typedef {'red' | 'amber' | 'green'} RagValue
 */

/**
 * @typedef {object} CriterionResult
 * @property {RagValue} rag
 * @property {string} rubric_band_cited
 * @property {string} explanation
 * @property {boolean} missing_evidence
 */

/**
 * @typedef {object} ScoringFlags
 * @property {boolean} access_request
 * @property {boolean} governance_required
 * @property {boolean} low_confidence
 */

/**
 * @typedef {object} ScoringResult
 * @property {Record<string, CriterionResult>} criteria
 * @property {'recommended_pattern' | 'hands_on_session' | 'referral_other_team' | 'refer_ai_unit'} routing_recommendation
 * @property {ScoringFlags} flags
 */

/**
 * @typedef {'opportunity' | 'access_request'} ClassificationKind
 */

/**
 * @typedef {object} Classification
 * @property {ClassificationKind} kind
 * @property {string} reason
 */

export const classificationZod = z.object({
  kind: z.enum(['opportunity', 'access_request']),
  reason: z.string().min(1)
})
const criterionResultZod = z.object({
  rag: z.enum(RAG_VALUES),
  rubric_band_cited: z.string().min(1),
  explanation: z.string().min(1),
  missing_evidence: z.boolean()
})

export const scoringResultZod = z.object({
  criteria: z.object(
    Object.fromEntries(CRITERION_KEYS.map((key) => [key, criterionResultZod]))
  ),
  routing_recommendation: z.enum(ROUTING_VALUES),
  flags: z.object({
    access_request: z.boolean(),
    governance_required: z.boolean(),
    low_confidence: z.boolean()
  })
})

const criterionResultJoi = Joi.object({
  rag: Joi.string()
    .valid(...RAG_VALUES)
    .required(),
  rubric_band_cited: Joi.string().min(1).required(),
  explanation: Joi.string().min(1).required(),
  missing_evidence: Joi.boolean().required()
})

export const scoringResultJoi = Joi.object({
  criteria: Joi.object(
    Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, criterionResultJoi.required()])
    )
  ).required(),
  routing_recommendation: Joi.string()
    .valid(...ROUTING_VALUES)
    .required(),
  flags: Joi.object({
    access_request: Joi.boolean().required(),
    governance_required: Joi.boolean().required(),
    low_confidence: Joi.boolean().required()
  }).required()
}).preferences({ convert: false })
