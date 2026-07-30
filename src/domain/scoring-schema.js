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
 * @property {string} evidence_quoted
 * @property {string} explanation
 * @property {boolean} missing_evidence
 */

/**
 * The flags the model reports. Note there is no `access_request` here — the
 * classification stage owns that question and answers it before scoring runs.
 *
 * @typedef {object} ScoringFlags
 * @property {boolean} governance_required
 * @property {boolean} low_confidence
 */

/**
 * @typedef {object} ScoringResult
 * @property {Record<string, CriterionResult>} criteria
 * @property {'recommended_pattern' | 'hands_on_session' | 'referral_other_team' | 'refer_ai_unit'} routing_recommendation
 * @property {string} pattern_cited
 * @property {ScoringFlags} flags
 */

/**
 * A scoring result once the service has stamped it with the facts the model is
 * not asked for: which rubric applied, and the classification's own verdict that
 * this is not an access request.
 *
 * @typedef {ScoringResult & { rubric_version: string, flags: ScoringFlags & { access_request: boolean } }} ScoredResult
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
  // Verbatim words from the submission the rating rests on; empty when the
  // submission says nothing relevant to the criterion.
  evidence_quoted: z.string(),
  explanation: z.string().min(1),
  missing_evidence: z.boolean()
})

/**
 * The flags the model is asked for.
 *
 * `access_request` is deliberately absent. Classification runs before scoring and
 * returns early for an access request, so the scorer only ever sees a submission
 * already judged an opportunity — asking it the same question again can produce
 * nothing but a contradiction of the stage that let the submission through. The
 * service sets the field on the stored result instead; see `storedFlagsZod`.
 */
const modelFlagsZod = z.object({
  governance_required: z.boolean(),
  low_confidence: z.boolean()
})

/**
 * The object shape, before the pattern rule is applied.
 *
 * Kept separate because `superRefine` returns a wrapper with no `.extend`, and the
 * stored-result shape below has to extend this one.
 */
const scoringResultShape = z.object({
  criteria: z.object(
    Object.fromEntries(CRITERION_KEYS.map((key) => [key, criterionResultZod]))
  ),
  routing_recommendation: z.enum(ROUTING_VALUES),
  // The toolkit pattern being recommended, named. Empty for every routing
  // other than recommended_pattern — see the refinement below.
  pattern_cited: z.string(),
  flags: modelFlagsZod
})

export const scoringResultZod = scoringResultShape.superRefine(
  requirePatternWhenRecommended
)

/**
 * A recommended pattern must name the pattern it recommends, and nothing else
 * may name one.
 *
 * Recommending the idea of a pattern without naming one is the failure the rubric's
 * RECOMMENDED_PATTERN_REQUIRES_CITATION was written to prevent, and which it did
 * not prevent, being a constant nothing read. Where no catalogue pattern fits, the
 * decided rule is to route to a hands-on session and say why — so this rule always
 * has a way out that does not involve inventing a pattern name.
 *
 * @param {{ routing_recommendation: string, pattern_cited: string }} result
 * @param {import('zod').RefinementCtx} ctx
 */
function requirePatternWhenRecommended(result, ctx) {
  const recommends = result.routing_recommendation === 'recommended_pattern'
  if (recommends && result.pattern_cited.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['pattern_cited'],
      message:
        'recommended_pattern must name a pattern from the AI digital toolkit catalogue; route to hands_on_session instead when none fits'
    })
  }
  if (!recommends && result.pattern_cited.trim() !== '') {
    ctx.addIssue({
      code: 'custom',
      path: ['pattern_cited'],
      message: `pattern_cited must be empty when routing_recommendation is ${result.routing_recommendation}`
    })
  }
}

const criterionResultJoi = Joi.object({
  rag: Joi.string()
    .valid(...RAG_VALUES)
    .required(),
  rubric_band_cited: Joi.string().min(1).required(),
  evidence_quoted: Joi.string().allow('').required(),
  explanation: Joi.string().min(1).required(),
  missing_evidence: Joi.boolean().required()
})

/**
 * The scoring result once the service has stamped it with the rubric version.
 *
 * Kept separate from the model-facing shapes above on purpose. `scoringResultZod`
 * is handed to the model as its structured-output schema, and the model is being
 * asked to apply the rubric, not to report on which one it applied — a
 * model-supplied version is a value that can be wrong. The service sets it, and
 * these are the shapes that describe a result fit to store.
 */
export const scoredResultZod = scoringResultShape
  .extend({
    rubric_version: z.string().min(1),
    // Set by the service, always false: a scored result exists only because
    // classification returned 'opportunity'. See modelFlagsZod above.
    flags: modelFlagsZod.extend({ access_request: z.boolean() })
  })
  .superRefine(requirePatternWhenRecommended)

export const scoringResultJoi = Joi.object({
  criteria: Joi.object(
    Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, criterionResultJoi.required()])
    )
  ).required(),
  routing_recommendation: Joi.string()
    .valid(...ROUTING_VALUES)
    .required(),
  // A recommended pattern must name one; nothing else may. Where no catalogue
  // pattern fits, the decided rule is to route to a hands-on session instead.
  // Note there is no .allow('') on the base. Joi concatenates the base schema with
  // the branch below, so a base that permits the empty string would keep permitting
  // it inside `then` and the rule would never bite.
  pattern_cited: Joi.string()
    .required()
    .when('routing_recommendation', {
      is: 'recommended_pattern',
      then: Joi.string().trim().min(1),
      otherwise: Joi.string().valid('')
    }),
  // No access_request here, for the reason given on modelFlagsZod: the classifier
  // owns that question. The stored shape below adds it back.
  flags: Joi.object({
    governance_required: Joi.boolean().required(),
    low_confidence: Joi.boolean().required()
  }).required()
}).preferences({ convert: false })

/**
 * The Joi counterpart of scoredResultZod: a result fit to store.
 *
 * The stored shape is unchanged by this — it still carries `flags.access_request`,
 * so nothing downstream breaks. What changed is where the value comes from: the
 * service, not the model.
 */
export const scoredResultJoi = scoringResultJoi.keys({
  rubric_version: Joi.string().min(1).required(),
  flags: Joi.object({
    access_request: Joi.boolean().required(),
    governance_required: Joi.boolean().required(),
    low_confidence: Joi.boolean().required()
  }).required()
})
