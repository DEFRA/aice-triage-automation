/**
 * @typedef {import('#/domain/scoring-schema.js').ScoringResult} ScoringResult
 */

/**
 * @typedef {object} PipelineResult
 * @property {string} id
 * @property {'opportunity' | 'access_request'} kind
 * @property {string} reason
 * @property {ScoringResult | null} scoring
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
    scoring
  }
}
