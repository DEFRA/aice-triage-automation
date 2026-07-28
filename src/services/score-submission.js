import { RUBRIC_VERSION } from '#/domain/rubric.js'

/**
 * @typedef {import('#/domain/scoring-schema.js').ScoredResult} ScoredResult
 */

/**
 * @typedef {object} PipelineResult
 * @property {string} id
 * @property {'opportunity' | 'access_request'} kind
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

  if (classification.kind === 'access_request') {
    return {
      id: submission.id,
      kind: 'access_request',
      reason: classification.reason,
      scoring: null
    }
  }

  const scoring = await engine.score(submission.text)

  return {
    id: submission.id,
    kind: 'opportunity',
    reason: classification.reason,
    // Spread first, then set: the service is the authority on which rubric was
    // applied, so anything the model volunteered here is overwritten.
    scoring: { ...scoring, rubric_version: RUBRIC_VERSION }
  }
}
