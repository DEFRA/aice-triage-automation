/**
 * The scoring rubric as data, single source of truth for schema and AI instructions.
 *
 * Originally transcribed verbatim from source documents. Verified 2026-07-13
 * against "Scoring AI opportunities" and "Use Case Scoring": all eight criterion
 * names and band definitions matched, with no ambiguous wording found.
 *
 * PROVENANCE, from 2026-07-29: this is no longer a pure transcription. The risk
 * and business_value bands carry text the team decided, and ROUTING_RULES did
 * not exist in the source documents at all — the rubric's guidance covered weak
 * and mixed cases only, and every routing disagreement the scoring exploration
 * observed traced back to a rule nobody had written down. Where a decision and
 * the source documents disagree, the decision wins and a comment names it.
 * Every other band is still the source documents, and for those the original
 * rule holds: keep them aligned, and do not paraphrase from memory.
 *
 * All four decisions are PROVISIONAL pending the triage panel.
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
 * 2026-07-29 — four routing decisions taken, provisional pending the triage
 *   panel. Risk and business_value band text rewritten; ROUTING_RULES,
 *   MISSING_EVIDENCE_THRESHOLD and PROVENANCE_RULE added.
 * 2026-07-13 — first version, transcribed from the source documents.
 *
 * Keep in step with RUBRIC_VERSION in the scoring exploration harness
 * (init_scoring_exploration_01/app/src/rubric.js). The two copies are the same
 * rubric, and calibration evidence from the harness is compared against scores
 * this service produced.
 *
 * @type {string}
 */
export const RUBRIC_VERSION = '2026-07-29'

/** @type {ReadonlyArray<Criterion>} */
export const CRITERIA = [
  {
    // Decision 2 (2026-07-29), option B. "Quantified" means data collected and
    // evidenced in ANY unit — the unit is not the test. Hours, cases, farms and
    // pounds all count. Where figures are given but the underlying data is not
    // linked, the colour stands and missing_evidence is set instead; see
    // PROVENANCE_RULE below. Was: red 'No benefit case', green 'Quantified case
    // for AI specifically'.
    key: 'business_value',
    name: 'Business value',
    whatToLookAt: 'The AI-specific benefit case',
    red: 'No benefit case, or no supporting data mentioned',
    amber: 'Real problem, AI value not quantified',
    green:
      'Quantified case for AI specifically — figures given in any evidenced ' +
      'unit (money, hours, cases, or counts of people, businesses or land ' +
      'affected)'
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
    // Decision 1 (2026-07-29), option A. Two additions to red — environmental
    // damage, and public-facing misinformation, on the grounds that eroding
    // public trust is a severe harm rather than a reputational one. Mitigation
    // does NOT move the band: the models scored amber every time by crediting a
    // human-in-the-loop, where four of five human scorers scored red. Amber is
    // reworded in step, or the two bands overlap and either colour is
    // defensible on the same submission. Was: red 'High safety, citizen harm,
    // regulatory exposure', amber 'Low safety, real reputational or financial
    // risk'.
    key: 'risk',
    name: 'Risk',
    whatToLookAt: 'Safety, reputational, financial, regulatory, environmental',
    red:
      'High safety risk, citizen harm, environmental damage, or regulatory ' +
      'exposure — including public-facing misinformation or incorrect ' +
      'guidance that a citizen or business could act on. These score red even ' +
      'when mitigated, for example by a human-in-the-loop',
    amber:
      'Low safety risk, real financial risk, or reputational risk that does ' +
      'not involve misleading the public — for example an internal tool that ' +
      'performs poorly in front of colleagues',
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

/**
 * Decision 2 (2026-07-29). Provenance does not move the business_value colour —
 * it sets the criterion's missing_evidence flag instead, so that thin evidence is
 * penalised once rather than twice: once by dropping the colour, and again by
 * raising the count MISSING_EVIDENCE_THRESHOLD reads.
 *
 * Note the scorer receives the text of the intake form and nothing else. An
 * attachment never reaches it; a link does, because a link is text in the
 * answer. So this rule is only reliably applicable to *linked* data — which is
 * why the colour does not depend on it.
 *
 * @type {string}
 */
export const PROVENANCE_RULE =
  'When a benefit case gives figures but the underlying data is not linked, ' +
  'keep the band the figures earn and set missing_evidence for business_value.'

/**
 * Decision 3 (2026-07-29). How many of the eight criteria must be flagged as
 * missing evidence before the grid stops being trustworthy enough to route from.
 *
 * Four, not three: across nine repeated rounds of the same submission the flag
 * count moved by three, so three fires inside that noise and the reply flickers
 * between re-scorings. Four fires only where every scorer, human and machine,
 * already agreed the submission was unscoreable.
 *
 * This number is only safe because decision 1 made public-facing exposure score
 * red — the submissions three would have caught are caught on risk instead. If
 * the risk band is ever relaxed, revisit this number in the same commit.
 *
 * @type {number}
 */
export const MISSING_EVIDENCE_THRESHOLD = 4

/**
 * @typedef {object} RoutingRule
 * @property {string} key      Stable machine key for the routing function.
 * @property {string} when     The condition, phrased so it can become an `if`.
 * @property {string} route    The routing recommendation this rule produces.
 * @property {string} because  Why the rule exists — the evidence, in a sentence.
 */

/**
 * The routing rules, in precedence order — first match wins.
 *
 * Decided 2026-07-29, provisional pending the triage panel. Two things they
 * assume, both outside this module. **Classification runs first** — only a
 * submission classified as a use case reaches these rules, and without that the
 * conversation rule pulls in anything that mentions a call. And
 * **missing_evidence must be set reliably**, since one rule counts it.
 *
 * These are data, not behaviour. Deriving the routing recommendation from a
 * scored grid rather than asking the model for it is separate, still-pending
 * work; until it lands the model is asked to apply these rules, which is the
 * arrangement the decision itself calls second-best.
 *
 * @type {ReadonlyArray<RoutingRule>}
 */
export const ROUTING_RULES = [
  {
    key: 'evident_conversation',
    when: 'the requester explicitly asks for advice or a conversation',
    route: 'hands_on_session',
    because:
      'Every scorer who routed the catch-records submission chose a session — ' +
      'three humans, a fourth within a two-way answer, and both models — and ' +
      'suggestive prompt wording alone moved the model 0 times in 6, so only a ' +
      'written rule binds. Score the grid anyway: it seeds the conversation.'
  },
  {
    key: 'incomplete_evidence',
    when: `${MISSING_EVIDENCE_THRESHOLD} or more of the eight criteria are flagged as missing evidence`,
    route: 'hands_on_session',
    because:
      'The grid is not trustworthy enough to route from. Talk to them and ' +
      'gather the evidence instead.'
  },
  {
    key: 'reading_patterns',
    when: 'one of the weak-or-mixed reading patterns fits the grid',
    route: 'per the pattern',
    because:
      'The rubric’s existing "how to read the picture" guidance, unchanged — ' +
      'see READING_PATTERNS above.'
  },
  {
    key: 'strong_case',
    when: 'nothing above has fired',
    route: 'recommended_pattern',
    because:
      'PROVISIONAL DEFAULT, not a decision. The strong case is the one question ' +
      'the team has never settled, and the one with no observed cases: under ' +
      'decision 1 it may be that no submission ever scored was strong across ' +
      'the row. It matches the models’ unanimous behaviour and the offering’s ' +
      '"resolved in 1–2 calls" measure. One value to flip when the panel ' +
      'decides properly.'
  }
]

/**
 * A recommended pattern means a *named* pattern from the AI digital toolkit's
 * catalogue, https://digital.defra.gov.uk/ai-toolkit/patterns. Recommending the
 * idea of a pattern without naming one is the failure this guards against — so
 * where no catalogue pattern fits, the reply falls through to a hands-on session
 * and says why.
 *
 * @type {boolean}
 */
export const RECOMMENDED_PATTERN_REQUIRES_CITATION = true
