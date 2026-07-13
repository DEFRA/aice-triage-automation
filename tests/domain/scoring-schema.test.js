import { describe, test, expect } from 'vitest'

import { CRITERION_KEYS } from '#/domain/rubric.js'
import { scoringResultJoi, scoringResultZod } from '#/domain/scoring-schema.js'

const wellFormed = {
  criteria: Object.fromEntries(
    CRITERION_KEYS.map((key) => [
      key,
      {
        rag: 'green',
        rubric_band_cited: 'Structured, accessible, well understood',
        explanation: 'The submission clearly describes its data sources.',
        missing_evidence: false
      }
    ])
  ),
  routing_recommendation: 'recommended_pattern',
  flags: {
    access_request: false,
    governance_required: false,
    low_confidence: false
  }
}

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
})
