import { describe, test, expect, vi } from 'vitest'

import { RUBRIC_VERSION } from '#/domain/rubric.js'
import { scoreSubmission } from '#/services/score-submission.js'

const someValidScoring = {
  criteria: {},
  routing_recommendation: 'hands_on_session',
  pattern_cited: '',
  flags: {
    governance_required: false,
    low_confidence: false
  }
}

const submission = { id: 'sub-001', text: 'Some submission text.' }

describe('#services/score-submission', () => {
  test('AC1: access_request result has kind, null scoring, and classifier reason', async () => {
    const engine = {
      name: 'fake',
      classify: vi.fn().mockResolvedValue({
        kind: 'access_request',
        reason: 'Licence request.'
      }),
      score: vi.fn()
    }

    const result = await scoreSubmission(engine, submission)

    expect(result.id).toBe('sub-001')
    expect(result.kind).toBe('access_request')
    expect(result.reason).toBe('Licence request.')
    expect(result.scoring).toBeNull()
  })

  test('AC2: engine.score is never called for an access_request', async () => {
    const engine = {
      name: 'fake',
      classify: vi.fn().mockResolvedValue({
        kind: 'access_request',
        reason: 'Licence request.'
      }),
      score: vi.fn()
    }

    await scoreSubmission(engine, submission)

    expect(engine.score).not.toHaveBeenCalled()
  })

  test('AC3: opportunity result has kind, scoring, and classifier reason', async () => {
    const engine = {
      name: 'fake',
      classify: vi
        .fn()
        .mockResolvedValue({ kind: 'opportunity', reason: 'AI use case.' }),
      score: vi.fn().mockResolvedValue(someValidScoring)
    }

    const result = await scoreSubmission(engine, submission)

    expect(result.id).toBe('sub-001')
    expect(result.kind).toBe('opportunity')
    expect(result.reason).toBe('AI use case.')
    expect(result.scoring).toEqual({
      ...someValidScoring,
      rubric_version: RUBRIC_VERSION,
      // Both of these are the service's to set, not the model's — see stories
      // 33 and 36. The engine above returned neither.
      flags: { ...someValidScoring.flags, access_request: false }
    })
  })

  test('AC4: classify rejection propagates', async () => {
    const engine = {
      name: 'fake',
      classify: vi.fn().mockRejectedValue(new Error('classify failed')),
      score: vi.fn()
    }

    await expect(scoreSubmission(engine, submission)).rejects.toThrow(
      'classify failed'
    )
  })

  test('AC5: score rejection propagates', async () => {
    const engine = {
      name: 'fake',
      classify: vi
        .fn()
        .mockResolvedValue({ kind: 'opportunity', reason: 'AI use case.' }),
      score: vi.fn().mockRejectedValue(new Error('score failed'))
    }

    await expect(scoreSubmission(engine, submission)).rejects.toThrow(
      'score failed'
    )
  })

  test('story 33 AC2: the service stamps the rubric version onto the grid', async () => {
    const engine = {
      name: 'fake',
      classify: vi
        .fn()
        .mockResolvedValue({ kind: 'opportunity', reason: 'AI use case.' }),
      score: vi.fn().mockResolvedValue(someValidScoring)
    }

    const result = await scoreSubmission(engine, submission)

    expect(result.scoring.rubric_version).toBe(RUBRIC_VERSION)
  })

  test('story 33 AC2: a version volunteered by the model cannot influence the stored value', async () => {
    const engine = {
      name: 'fake',
      classify: vi
        .fn()
        .mockResolvedValue({ kind: 'opportunity', reason: 'AI use case.' }),
      score: vi.fn().mockResolvedValue({
        ...someValidScoring,
        rubric_version: 'whatever-the-model-decided'
      })
    }

    const result = await scoreSubmission(engine, submission)

    expect(result.scoring.rubric_version).toBe(RUBRIC_VERSION)
  })

  test('story 33: an access request carries no rubric version — no rubric was applied', async () => {
    const engine = {
      name: 'fake',
      classify: vi.fn().mockResolvedValue({
        kind: 'access_request',
        reason: 'Licence request.'
      }),
      score: vi.fn()
    }

    const result = await scoreSubmission(engine, submission)

    expect(result.scoring).toBeNull()
  })

  describe('story 36: the classifier decides access_request, not the scorer', () => {
    // A live run on 30 July 2026 produced two results where the classifier said
    // 'opportunity' and the grid that followed set access_request true. The
    // service now settles it, because execution only reaches the scorer when
    // classification already answered no.

    test('a scored result always carries access_request false', async () => {
      const engine = {
        name: 'fake',
        classify: vi
          .fn()
          .mockResolvedValue({ kind: 'opportunity', reason: 'A use case.' }),
        score: vi.fn().mockResolvedValue(someValidScoring)
      }

      const result = await scoreSubmission(engine, submission)

      expect(result.scoring.flags.access_request).toBe(false)
    })

    test('a model that returns access_request true cannot override the classifier', async () => {
      const engine = {
        name: 'fake',
        classify: vi
          .fn()
          .mockResolvedValue({ kind: 'opportunity', reason: 'A use case.' }),
        score: vi.fn().mockResolvedValue({
          ...someValidScoring,
          flags: { ...someValidScoring.flags, access_request: true }
        })
      }

      const result = await scoreSubmission(engine, submission)

      expect(result.kind).toBe('opportunity')
      expect(result.scoring.flags.access_request).toBe(false)
    })
  })
})
