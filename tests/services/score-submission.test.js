import { describe, test, expect, vi } from 'vitest'

import { scoreSubmission } from '#/services/score-submission.js'

const someValidScoring = {
  criteria: {},
  routing_recommendation: 'hands_on_session',
  flags: {
    access_request: false,
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
    expect(result.scoring).toBe(someValidScoring)
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
})
