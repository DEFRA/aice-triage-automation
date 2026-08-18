import { describe, test, expect } from 'vitest'

import {
  CRITERIA,
  CRITERION_KEYS,
  MISSING_EVIDENCE_THRESHOLD,
  ROUTING_RULES
} from '#/domain/rubric.js'
import {
  SCORING_SYSTEM_PROMPT,
  CLASSIFIER_SYSTEM_PROMPT
} from '#/agents/prompt.js'

describe('#agents/prompt', () => {
  test('AC3: prompt contains every criterion key', () => {
    for (const key of CRITERION_KEYS) {
      expect(SCORING_SYSTEM_PROMPT).toContain(key)
    }
  })

  test('the prompt carries the decided band text, not a paraphrase of it', () => {
    for (const criterion of CRITERIA) {
      expect(SCORING_SYSTEM_PROMPT).toContain(criterion.red)
      expect(SCORING_SYSTEM_PROMPT).toContain(criterion.amber)
      expect(SCORING_SYSTEM_PROMPT).toContain(criterion.green)
    }
  })

  test('the prompt carries every routing rule, in precedence order', () => {
    const positions = ROUTING_RULES.map((rule) =>
      SCORING_SYSTEM_PROMPT.indexOf(rule.when)
    )

    for (const position of positions) {
      expect(position).toBeGreaterThan(-1)
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  test('the prompt states that the first matching rule wins', () => {
    // Without this the rules are a list of considerations, which is what the
    // rubric already had and what every observed routing disagreement came from.
    expect(SCORING_SYSTEM_PROMPT).toMatch(/IN ORDER/)
    expect(SCORING_SYSTEM_PROMPT).toMatch(/first rule that matches wins/i)
  })

  test('the prompt carries the missing-evidence threshold as a number', () => {
    expect(SCORING_SYSTEM_PROMPT).toContain(
      `${MISSING_EVIDENCE_THRESHOLD} or more`
    )
  })

  describe('regression: the calibration notes must not re-acquire a thumb on the scale', () => {
    // These three lines were in the prompt until 2026-07-29 and each one
    // instructed the model toward the behaviour the scoring evidence says is
    // wrong. "Most internal Defra cases land amber on risk" is the sharpest:
    // the human-model divergence on risk is what motivated the decision to
    // rewrite the red band, and the model may have been obeying this line
    // rather than reading the band. They are easy to reintroduce while tuning a
    // prompt, and nothing else in the suite would notice.

    test('it does not tell the model where Defra cases usually land on risk', () => {
      expect(SCORING_SYSTEM_PROMPT).not.toMatch(/land amber on risk/i)
      expect(SCORING_SYSTEM_PROMPT).not.toMatch(/most internal defra cases/i)
    })

    test('it does not pre-judge the benefit case toward amber', () => {
      expect(SCORING_SYSTEM_PROMPT).not.toMatch(/rarely quantified/i)
      expect(SCORING_SYSTEM_PROMPT).not.toMatch(/usually lands amber/i)
    })

    test('it does not require the benefit case to be expressed in money', () => {
      // Decision 2: any evidenced unit counts. The model held a 13,000
      // officer-hour case at amber for want of a figure in pounds.
      expect(SCORING_SYSTEM_PROMPT).toMatch(/any evidenced unit|ANY unit/i)
    })

    test('it does not let a described mitigation move a red risk to amber', () => {
      expect(SCORING_SYSTEM_PROMPT).toMatch(/score red even/i)
    })
  })

  describe('story 36: the scorer is not asked to classify', () => {
    test('it does not ask the model to set flags.access_request', () => {
      // Classification runs first and returns early for an access request, so the
      // scorer only ever sees an opportunity. Asking again produced two
      // self-contradicting results in the live run of 30 July 2026.
      expect(SCORING_SYSTEM_PROMPT).not.toMatch(/flags\.access_request/i)
    })
  })

  describe('story 34: the classifier offers a third kind', () => {
    test('it offers enquiry alongside the other two kinds', () => {
      expect(CLASSIFIER_SYSTEM_PROMPT).toMatch(/three kinds/i)
      expect(CLASSIFIER_SYSTEM_PROMPT).toContain('enquiry')
      expect(CLASSIFIER_SYSTEM_PROMPT).toContain('opportunity')
      expect(CLASSIFIER_SYSTEM_PROMPT).toContain('access_request')
    })

    test('it says which way to fall when a submission could be read either way', () => {
      // The new kind becomes a dustbin without this. An opportunity swallowed
      // as an enquiry is never scored, so the mistake leaves no trace — unlike a
      // missed enquiry, which at least produces a grid someone may query.
      expect(CLASSIFIER_SYSTEM_PROMPT).toMatch(/choose opportunity/i)
    })

    test('it says which kind wins when a licence ask also questions the rules', () => {
      // The stub encodes this precedence in the order of its branches. Without
      // the same rule stated here, the two engines disagree about the same
      // submission, and only the stub's answer is covered by a test.
      expect(CLASSIFIER_SYSTEM_PROMPT).toMatch(
        /an access_request, not an enquiry/i
      )
      expect(CLASSIFIER_SYSTEM_PROMPT).toMatch(
        /without the tool they asked for/i
      )
    })

    test('it asks for a reason that stands in for the grid', () => {
      expect(CLASSIFIER_SYSTEM_PROMPT).toMatch(/instead of a scoring grid/i)
    })
  })

  describe('story 37: a recommended pattern must name a pattern', () => {
    test('it tells the model to name the pattern, and where the catalogue is', () => {
      expect(SCORING_SYSTEM_PROMPT).toMatch(/pattern_cited/)
      expect(SCORING_SYSTEM_PROMPT).toMatch(
        /digital\.defra\.gov\.uk\/ai-toolkit\/patterns/
      )
    })

    test('it gives the way out, so no pattern name is ever invented', () => {
      // A required field with no escape hatch produces fabricated pattern names,
      // which is a worse failure than the one being fixed: a made-up name reads
      // exactly like a real recommendation.
      expect(SCORING_SYSTEM_PROMPT).toMatch(/no catalogue pattern fits/i)
      expect(SCORING_SYSTEM_PROMPT).toMatch(/do not invent a name/i)
    })
  })
})
