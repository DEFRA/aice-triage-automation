import { RUBRIC_VERSION } from '#/domain/rubric.js'
import { SCORED_KIND } from '#/domain/scoring-schema.js'

/**
 * @typedef {import('#/domain/scoring-schema.js').ScoredResult} ScoredResult
 */

/**
 * @typedef {object} PipelineResult
 * @property {string} id
 * @property {import('#/domain/scoring-schema.js').ClassificationKind} kind
 * @property {string} reason
 * @property {ScoredResult | null} scoring
 */

/**
 * @param {import('#/agents/engine.js').Engine} engine
 * @param {{ id: string, text: string }} submission
 * @returns {Promise<PipelineResult>}
 */
export async function scoreSubmission(engine, submission) {
  const classification = await engine.classify(submission.text)

  // An allowlist, and deliberately not a list of kinds to skip. A denylist fails
  // open: a kind added to the enum but forgotten here would fall through to the
  // scorer and be stamped 'opportunity' on the way out. This way a kind nobody
  // has taught the service about is returned unscored, carrying its own name.
  if (classification.kind !== SCORED_KIND) {
    return {
      id: submission.id,
      // The classifier's own answer, not a literal. This line used to hardcode
      // 'access_request', which was true while that was the only unscored kind
      // and would have silently relabelled every enquiry as a licence request.
      kind: classification.kind,
      reason: classification.reason,
      scoring: null
    }
  }

  const scoring = await engine.score(submission.text)

  return {
    id: submission.id,
    kind: SCORED_KIND,
    reason: classification.reason,
    // Spread first, then set: the service is the authority on which rubric was
    // applied, so anything the model volunteered here is overwritten.
    scoring: {
      ...scoring,
      rubric_version: RUBRIC_VERSION,
      // Always false, and set here rather than asked of the model. Execution only
      // reaches this line because classification returned 'opportunity', so the
      // scorer answering the same question again could only contradict it.
      flags: { ...scoring.flags, access_request: false }
    }
  }
}
