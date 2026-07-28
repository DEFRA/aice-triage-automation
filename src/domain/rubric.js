/**
 * The scoring rubric as data, single source of truth for schema and AI instructions.
 * Transcribed verbatim from source documents.
 *
 * Transcription note: source docs reviewed for ambiguities.
 * No ambiguous wording found across the two source documents.
 *
 * AC4 verification: rubric read back against both source documents.
 * All eight criterion names and band definitions match verbatim.
 * Verified 2026-07-13 against:
 * - Scoring AI opportunities
 * - Use Case Scoring
 */
/**
 * @typedef {'red' | 'amber' | 'green'} RagValue
 */

/**
 * @typedef {object} Criterion
 * @property {string} key
 * @property {string} name
 * @property {string} whatToLookAt
 * @property {string} red
 * @property {string} amber
 * @property {string} green
 */

/**
 * @typedef {object} CriterionScore
 * @property {string} key
 * @property {RagValue} rating
 * @property {string} evidenceQuote
 */

/**
 * @typedef {object} ScoringResult
 * @property {ReadonlyArray<CriterionScore>} criteria
 * @property {'recommended_pattern' | 'hands_on_session' | 'referral_other_team' | 'refer_ai_unit'} routing
 * @property {string} readingPattern
 */
/**
 * Which version of the rubric a score was taken under.
 *
 * Date-stamped rather than numbered, so that the value is self-describing when
 * it turns up in a stored result months later: it says when these rules were
 * true. The first version is the date the transcription above was verified
 * against the source documents.
 *
 * THE RULE: change this in the same commit as any change to the band text, the
 * reading patterns, or the routing rules derived from them. A score is only
 * comparable with another score taken under the same version, so a rubric edit
 * that leaves this untouched silently mixes two sets of rules together.
 *
 * @type {string}
 */
export const RUBRIC_VERSION = '2026-07-13'

/** @type {ReadonlyArray<Criterion>} */
export const CRITERIA = [
  {
    key: 'business_value',
    name: 'Business value',
    whatToLookAt: 'The AI-specific benefit case',
    red: 'No benefit case',
    amber: 'Real problem, AI value not quantified',
    green: 'Quantified case for AI specifically'
  },
  {
    key: 'user_impact',
    name: 'User impact',
    whatToLookAt: 'Number, evidence and lived experience of users',
    red: 'User need asserted, no evidence',
    amber: 'Real for some users, unclear for others',
    green: 'Confirmed need, meaningful change'
  },
  {
    key: 'data_readiness',
    name: 'Data readiness',
    whatToLookAt: 'Whether the data exists and is usable',
    red: 'Fragmented, inconsistent, no tagging',
    amber: 'Available, quality or volume untested',
    green: 'Structured, accessible, well understood'
  },
  {
    key: 'process_stability',
    name: 'Process stability',
    whatToLookAt: 'Whether the process is mapped and stable',
    red: 'No project, team, or process being redesigned',
    amber: 'Partly mapped, evolving',
    green: 'End-to-end mapped, ready for AI'
  },
  {
    key: 'ai_fit',
    name: 'AI fit',
    whatToLookAt: 'Whether AI is the right shape for the problem',
    red: 'Deterministic problem, AI adds risk',
    amber: 'Some parts fit, others do not',
    green: 'Clear AI shape (language, retrieval, classification)'
  },
  {
    key: 'risk',
    name: 'Risk',
    whatToLookAt: 'Safety, reputational, financial, regulatory',
    red: 'High safety, citizen harm, regulatory exposure',
    amber: 'Low safety, real reputational or financial risk',
    green: 'Low risk on every dimension'
  },
  {
    key: 'scalability',
    name: 'Scalability',
    whatToLookAt: 'Reusable patterns beyond this team',
    red: 'Bespoke, no reuse',
    amber: 'Technical reuse, no novel pattern',
    green: 'Reusable pattern for other teams'
  },
  {
    key: 'cross_defra_value',
    name: 'Cross-Defra value',
    whatToLookAt: 'Reach across Defra group',
    red: 'Single team, unlikely to spread',
    amber: 'Single agency, potential to extend',
    green: 'Multi-agency, flagship, strategic'
  }
]

/** Stable criterion keys, in rubric order. @type {ReadonlyArray<string>} */
export const CRITERION_KEYS = CRITERIA.map((criterion) => criterion.key)

/** @type {ReadonlyArray<RagValue>} */
export const RAG_VALUES = ['red', 'amber', 'green']

/** @type {ReadonlyArray<'recommended_pattern' | 'hands_on_session' | 'referral_other_team' | 'refer_ai_unit'>} */
export const ROUTING_VALUES = [
  'recommended_pattern',
  'hands_on_session',
  'referral_other_team',
  'refer_ai_unit'
]

/** @type {ReadonlyArray<string>} */
export const READING_PATTERNS = [
  'Strong reach, weak readiness: engage later, when conditions are in place.',
  'Stable process, weak AI fit: route to a team better placed for the build.',
  'Mixed, with one or two clear AI candidates: engage where AI fits, refer the rest.'
]
