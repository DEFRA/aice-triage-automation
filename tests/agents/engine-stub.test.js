import { readFile } from 'node:fs/promises'
import { describe, test, expect, vi } from 'vitest'

import { createStubEngine } from '#/agents/engine-stub.js'
import { CRITERION_KEYS } from '#/domain/rubric.js'
import { classificationZod, scoringResultJoi } from '#/domain/scoring-schema.js'

async function readFixture(name) {
  const path = new URL(`../fixtures/submissions/${name}`, import.meta.url)
  return readFile(path, 'utf8')
}

describe('#agents/engine-stub', () => {
  test('CreateStubEngine returns object with name and score', () => {
    const engine = createStubEngine()

    expect(engine).toBeDefined()
    expect(engine.name).toBe('stub')
    expect(typeof engine.score).toBe('function')
  })

  test('Score makes no network call', async () => {
    const engine = createStubEngine()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const text = await readFixture('non-governance.txt')
    await engine.score(text)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  test('Score is deterministic for same input', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const first = await engine.score(text)
    const second = await engine.score(text)

    expect(first).toEqual(second)
  })

  test('Stub output passes scoringResultJoi', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)
    const { error } = scoringResultJoi.validate(result)

    expect(error).toBeUndefined()
  })

  test('Output has exactly one entry per rubric criterion key', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)
    const keys = Object.keys(result.criteria)

    expect(keys).toHaveLength(CRITERION_KEYS.length)
    expect([...keys].sort()).toEqual([...CRITERION_KEYS].sort())
  })

  test('Governance input sets governance flag and refer_ai_unit routing', async () => {
    const engine = createStubEngine()
    const text = await readFixture('governance.txt')

    const result = await engine.score(text)

    expect(result.flags.governance_required).toBe(true)
    expect(result.routing_recommendation).toBe('refer_ai_unit')
  })

  test('Non-governance input clears governance flag and uses hands_on_session', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)

    expect(result.flags.governance_required).toBe(false)
    expect(result.routing_recommendation).toBe('hands_on_session')
  })

  test('CreateStubEngine returns object with classify', () => {
    const engine = createStubEngine()
    expect(typeof engine.classify).toBe('function')
  })
  test('Access-request fixture classified as access_request and passes classificationZod', async () => {
    const engine = createStubEngine()
    const text = await readFixture('access-request.txt')

    const result = await engine.classify(text)

    expect(result.kind).toBe('access_request')
    expect(classificationZod.safeParse(result).success).toBe(true)
  })

  test('Opportunity fixture classified as opportunity and passes classificationZod', async () => {
    const engine = createStubEngine()
    const text = await readFixture('opportunity.txt')

    const result = await engine.classify(text)

    expect(result.kind).toBe('opportunity')
    expect(classificationZod.safeParse(result).success).toBe(true)
  })

  test('Classify makes no network call', async () => {
    const engine = createStubEngine()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const text = await readFixture('opportunity.txt')

    await engine.classify(text)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  describe('story 34: an enquiry is a third kind, and is not scored', () => {
    test('AC1: a question about which tools are permitted is an enquiry', async () => {
      const engine = createStubEngine()

      const result = await engine.classify(await readFixture('enquiry.txt'))

      expect(result.kind).toBe('enquiry')
      expect(classificationZod.safeParse(result).success).toBe(true)
    })

    test('AC1: a question about how guidance should be read is an enquiry', async () => {
      const engine = createStubEngine()

      const result = await engine.classify(
        await readFixture('enquiry-guidance.txt')
      )

      expect(result.kind).toBe('enquiry')
    })

    test('AC2: a use case that also asks a question stays an opportunity', async () => {
      // The guard against the new kind becoming a dustbin. The use case is the
      // substance and the question is the wrapper, and this shape is half of one
      // real batch. An opportunity swallowed as an enquiry is never scored, so
      // nobody ever sees a grid that looks wrong.
      const engine = createStubEngine()

      const result = await engine.classify(
        await readFixture('opportunity-with-question.txt')
      )

      expect(result.kind).toBe('opportunity')
    })

    test('AC3: a licence request for named people is still an access request', async () => {
      const engine = createStubEngine()

      const result = await engine.classify(
        await readFixture('access-request.txt')
      )

      expect(result.kind).toBe('access_request')
    })

    test('AC6: an enquiry classifies with no network call', async () => {
      const engine = createStubEngine()
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await engine.classify(await readFixture('enquiry.txt'))

      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })
  })
})
