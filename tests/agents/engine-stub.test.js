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
})
