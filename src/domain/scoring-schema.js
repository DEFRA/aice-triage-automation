import Joi from 'joi'
import { z } from 'zod'

import { CRITERION_KEYS, RAG_VALUES, ROUTING_VALUES } from '#/domain/rubric.js'

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
