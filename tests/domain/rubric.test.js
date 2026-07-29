import { createHash } from 'node:crypto'

import {
  CRITERIA,
  CRITERION_KEYS,
  MISSING_EVIDENCE_THRESHOLD,
  PROVENANCE_RULE,
  RAG_VALUES,
  READING_PATTERNS,
  ROUTING_RULES,
  ROUTING_VALUES,
  RUBRIC_VERSION
} from '#/domain/rubric.js'

describe('#domain/rubric', () => {
  test('has exactly eight criteria', () => {
    expect(CRITERIA).toHaveLength(8)
  })

  test('criterion keys are unique', () => {
    const keys = CRITERIA.map((criterion) => criterion.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('every criterion defines red, amber, green bands', () => {
    for (const criterion of CRITERIA) {
      expect(typeof criterion.red).toBe('string')
      expect(typeof criterion.amber).toBe('string')
      expect(typeof criterion.green).toBe('string')
      expect(criterion.red.trim().length).toBeGreaterThan(0)
      expect(criterion.amber.trim().length).toBeGreaterThan(0)
      expect(criterion.green.trim().length).toBeGreaterThan(0)
    }
  })

  test('CRITERION_KEYS is derived from CRITERIA in order', () => {
    expect(CRITERION_KEYS).toEqual(CRITERIA.map((criterion) => criterion.key))
  })

  test('RAG values are fixed and ordered', () => {
    expect(RAG_VALUES).toEqual(['red', 'amber', 'green'])
  })

  test('routing values are fixed', () => {
    expect(ROUTING_VALUES).toEqual([
      'recommended_pattern',
      'hands_on_session',
      'referral_other_team',
      'refer_ai_unit'
    ])
  })

  describe('story 33: the rubric version tracks the rubric text', () => {
    // Both values are pinned together on purpose. Editing any band text, reading
    // pattern or routing rule changes the digest and fails this test — and the
    // fix is to bump RUBRIC_VERSION and update both lines in the same commit.
    // The failure IS the reminder: it is the only thing standing between a
    // rubric edit and a database full of scores nobody can tell apart.
    //
    // It did its job on 2026-07-29: the four routing decisions rewrote the risk
    // and business_value bands, this test failed, and the version bump was the
    // deliberate act of accepting that. The digest now also covers ROUTING_RULES
    // and MISSING_EVIDENCE_THRESHOLD, which did not exist when it was written —
    // a routing rule changing silently is the same failure as a band changing
    // silently, and the comment on RUBRIC_VERSION always said so.
    const PINNED_VERSION = '2026-07-29'
    const PINNED_DIGEST =
      'eb606497dbe69b3b95046bae93a895f370faf2a02e36bb69e48905bedaf1df26'

    test('the rubric text has not changed without the version changing with it', () => {
      const digest = createHash('sha256')
        .update(
          JSON.stringify({
            CRITERIA,
            READING_PATTERNS,
            ROUTING_RULES,
            MISSING_EVIDENCE_THRESHOLD,
            PROVENANCE_RULE
          })
        )
        .digest('hex')

      expect(
        digest,
        'The rubric text changed. Bump RUBRIC_VERSION in src/domain/rubric.js and update PINNED_VERSION and PINNED_DIGEST here, in the same commit — otherwise scores taken under the old wording become indistinguishable from scores taken under the new one.'
      ).toBe(PINNED_DIGEST)

      expect(RUBRIC_VERSION).toBe(PINNED_VERSION)
    })

    test('the version is a non-empty, self-describing date stamp', () => {
      expect(RUBRIC_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
