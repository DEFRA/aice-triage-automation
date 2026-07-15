import { CRITERIA } from '#/domain/rubric.js'

/**
 * Deterministic engine, no network. Exercises the pipeline, routing,
 * validation and error paths without calling a hosted AI model.
 * Heuristics are placeholders, not real judgement.
 * @returns {import('./engine.js').Engine}
 */
export function createStubEngine() {
  return {
    name: 'stub',

    async score(text) {
      const governance =
        /governance|policy|approval|freedom of information|licen[sc]e/i.test(
          text
        )

      const criteria = Object.fromEntries(
        CRITERIA.map((criterion) => [
          criterion.key,
          {
            rag: 'amber',
            rubric_band_cited: criterion.amber,
            explanation: `Stub: placeholder amber rating for ${criterion.name}.`,
            missing_evidence: criterion.key === 'business_value'
          }
        ])
      )

      return {
        criteria,
        routing_recommendation: governance
          ? 'refer_ai_unit'
          : 'hands_on_session',
        flags: {
          access_request: false,
          governance_required: governance,
          low_confidence: false
        }
      }
    },

    async classify(text) {
      const emailCount = (text.match(/@[\w.-]+\.[a-z]{2,}/gi) ?? []).length
      const wantsTooling =
        /\bcopilot\b/i.test(text) && /(licen[sc]e|access)/i.test(text)
      const isAccessRequest = wantsTooling && emailCount >= 2

      return {
        kind: isAccessRequest ? 'access_request' : 'opportunity',
        reason: isAccessRequest
          ? 'Asks for tool licences or access for a named team (stub heuristic).'
          : 'Describes an AI use case to triage (stub heuristic).'
      }
    }
  }
}
