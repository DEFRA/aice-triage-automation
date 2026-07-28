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
    const scored = { ...wellFormed, rubric_version: RUBRIC_VERSION }

    test('a stamped result passes both scored-result schemas', () => {
      expect(scoredResultZod.safeParse(scored).success).toBe(true)
      expect(scoredResultJoi.validate(scored).error).toBeUndefined()
    })

    test('a result without rubric_version is rejected by both', () => {
      expect(scoredResultZod.safeParse(wellFormed).success).toBe(false)
      expect(scoredResultJoi.validate(wellFormed).error).toBeDefined()
    })

    test('an empty rubric_version is rejected by both', () => {
      const empty = { ...wellFormed, rubric_version: '' }

      expect(scoredResultZod.safeParse(empty).success).toBe(false)
      expect(scoredResultJoi.validate(empty).error).toBeDefined()
    })

    test('the model-facing shapes stay version-free, so the model is never asked for one', () => {
      expect(scoringResultZod.safeParse(wellFormed).success).toBe(true)
      expect(scoringResultJoi.validate(wellFormed).error).toBeUndefined()
    })
  })
})
