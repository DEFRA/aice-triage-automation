import { describe, test, expect } from 'vitest'

import { CRITERION_KEYS, RUBRIC_VERSION } from '#/domain/rubric.js'
import {
  scoringResultJoi,
  scoringResultZod,
  scoredResultJoi,
  scoredResultZod
} from '#/domain/scoring-schema.js'

const wellFormed = {
  criteria: Object.fromEntries(
    CRITERION_KEYS.map((key) => [
      key,
      {
        rag: 'green',
        rubric_band_cited: 'Structured, accessible, well understood',
        evidence_quoted: 'All records are held in a single SharePoint list.',
        explanation: 'The submission clearly describes its data sources.',
        missing_evidence: false
      }
    ])
  ),
  routing_recommendation: 'recommended_pattern',
  pattern_cited: 'Retrieval-augmented question answering',
  flags: {
    governance_required: false,
    low_confidence: false
  }
}

/** What the service stores: the model's result plus the facts it is not asked for. */
const stamped = (result = wellFormed) => ({
  ...result,
  rubric_version: RUBRIC_VERSION,
  flags: { ...result.flags, access_request: false }
})

const malformedCases = [
  {
    label: 'missing one criterion',
    input: {
      ...wellFormed,
      criteria: Object.fromEntries(
        CRITERION_KEYS.slice(1).map((key) => [key, wellFormed.criteria[key]])
      )
    }
  },
  {
    label: "rag value 'purple'",
    input: {
      ...wellFormed,
      criteria: {
        ...wellFormed.criteria,
        [CRITERION_KEYS[0]]: {
          ...wellFormed.criteria[CRITERION_KEYS[0]],
          rag: 'purple'
        }
      }
    }
  },
  {
    label: 'routing_recommendation not one of the four values',
    input: { ...wellFormed, routing_recommendation: 'not_a_valid_value' }
  },
  {
    label: 'evidence_quoted missing from a criterion',
    input: {
      ...wellFormed,
      criteria: {
        ...wellFormed.criteria,
        [CRITERION_KEYS[0]]: Object.fromEntries(
          Object.entries(wellFormed.criteria[CRITERION_KEYS[0]]).filter(
            ([field]) => field !== 'evidence_quoted'
          )
        )
      }
    }
  },
  {
    label: "missing_evidence is string 'true' not boolean",
    input: {
      ...wellFormed,
      criteria: {
        ...wellFormed.criteria,
        [CRITERION_KEYS[0]]: {
          ...wellFormed.criteria[CRITERION_KEYS[0]],
          missing_evidence: 'true'
        }
      }
    }
  }
]

describe('#domain/scoring-schema', () => {
  test('well-formed result passes scoringResultZod', () => {
    const result = scoringResultZod.safeParse(wellFormed)
    expect(result.success).toBe(true)
  })

  test('well-formed result passes scoringResultJoi', () => {
    const { error } = scoringResultJoi.validate(wellFormed)
    expect(error).toBeUndefined()
  })

  describe('malformed inputs are rejected by both schemas', () => {
    for (const { label, input } of malformedCases) {
      test(`rejected: ${label}`, () => {
        const zodResult = scoringResultZod.safeParse(input)
        expect(zodResult.success, `Zod accepted: ${label}`).toBe(false)

        const { error: joiError } = scoringResultJoi.validate(input)
        expect(joiError, `Joi accepted: ${label}`).toBeDefined()
      })
    }
  })

  describe('story 33: the scored-result shapes require a rubric version', () => {
    const scored = stamped()

    test('a stamped result passes both scored-result schemas', () => {
      expect(scoredResultZod.safeParse(scored).success).toBe(true)
      expect(scoredResultJoi.validate(scored).error).toBeUndefined()
    })

    test('a result without rubric_version is rejected by both', () => {
      const unstamped = { ...scored, rubric_version: undefined }

      expect(scoredResultZod.safeParse(unstamped).success).toBe(false)
      expect(scoredResultJoi.validate(unstamped).error).toBeDefined()
    })

    test('an empty rubric_version is rejected by both', () => {
      const empty = { ...scored, rubric_version: '' }

      expect(scoredResultZod.safeParse(empty).success).toBe(false)
      expect(scoredResultJoi.validate(empty).error).toBeDefined()
    })

    test('the model-facing shapes stay version-free, so the model is never asked for one', () => {
      expect(scoringResultZod.safeParse(wellFormed).success).toBe(true)
      expect(scoringResultJoi.validate(wellFormed).error).toBeUndefined()
    })
  })

  describe('story 36: the scorer is not asked whether this is an access request', () => {
    test('the model-facing shape does not carry access_request', () => {
      const parsed = scoringResultZod.parse(wellFormed)

      expect(parsed.flags).not.toHaveProperty('access_request')
    })

    test('a model that volunteers access_request cannot smuggle it through', () => {
      const volunteered = {
        ...wellFormed,
        flags: { ...wellFormed.flags, access_request: true }
      }

      expect(scoringResultZod.parse(volunteered).flags).not.toHaveProperty(
        'access_request'
      )
      expect(scoringResultJoi.validate(volunteered).error).toBeDefined()
    })

    test('the stored shape still requires it, so no consumer breaks', () => {
      const withoutFlag = {
        ...stamped(),
        flags: wellFormed.flags
      }

      expect(scoredResultZod.safeParse(withoutFlag).success).toBe(false)
      expect(scoredResultJoi.validate(withoutFlag).error).toBeDefined()
    })
  })

  describe('story 37: a recommended pattern must name a pattern', () => {
    const routed = (routing, pattern) => ({
      ...wellFormed,
      routing_recommendation: routing,
      pattern_cited: pattern
    })

    test('recommended_pattern with no pattern named is rejected by both', () => {
      const unnamed = routed('recommended_pattern', '')

      expect(scoringResultZod.safeParse(unnamed).success).toBe(false)
      expect(scoringResultJoi.validate(unnamed).error).toBeDefined()
    })

    test('whitespace does not count as naming a pattern', () => {
      const blank = routed('recommended_pattern', '   ')

      expect(scoringResultZod.safeParse(blank).success).toBe(false)
      expect(scoringResultJoi.validate(blank).error).toBeDefined()
    })

    test('any other routing must leave pattern_cited empty', () => {
      const stray = routed('hands_on_session', 'Retrieval-augmented generation')

      expect(scoringResultZod.safeParse(stray).success).toBe(false)
      expect(scoringResultJoi.validate(stray).error).toBeDefined()
    })

    test('any other routing with an empty pattern_cited passes', () => {
      const session = routed('hands_on_session', '')

      expect(scoringResultZod.safeParse(session).success).toBe(true)
      expect(scoringResultJoi.validate(session).error).toBeUndefined()
    })

    test('the rule holds on the stored shape too', () => {
      const storedUnnamed = stamped(routed('recommended_pattern', ''))

      expect(scoredResultZod.safeParse(storedUnnamed).success).toBe(false)
      expect(scoredResultJoi.validate(storedUnnamed).error).toBeDefined()
    })
  })
})
