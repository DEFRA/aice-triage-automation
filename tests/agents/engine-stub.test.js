import { readFile } from 'node:fs/promises'
import { describe, test, expect, vi } from 'vitest'

import { createStubEngine } from '#/agents/engine-stub.js'
import { CRITERION_KEYS } from '#/domain/rubric.js'
import { scoringResultJoi } from '#/domain/scoring-schema.js'

async function readFixture(name) {
  const path = new URL(`../fixtures/submissions/${name}`, import.meta.url)
  return readFile(path, 'utf8')
}

describe('#agents/engine-stub', () => {
  test('AC1: createStubEngine returns object with name and score', () => {
    const engine = createStubEngine()

    expect(engine).toBeDefined()
    expect(engine.name).toBe('stub')
    expect(typeof engine.score).toBe('function')
  })

  test('AC2: score makes no network call', async () => {
    const engine = createStubEngine()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const text = await readFixture('non-governance.txt')
    await engine.score(text)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  test('AC3: score is deterministic for same input', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const first = await engine.score(text)
    const second = await engine.score(text)

    expect(first).toEqual(second)
  })

  test('AC4: stub output passes scoringResultJoi', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)
    const { error } = scoringResultJoi.validate(result)

    expect(error).toBeUndefined()
  })

  test('AC5: output has exactly one entry per rubric criterion key', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)
    const keys = Object.keys(result.criteria)

    expect(keys).toHaveLength(CRITERION_KEYS.length)
    expect([...keys].sort()).toEqual([...CRITERION_KEYS].sort())
  })

  test('AC6: governance input sets governance flag and refer_ai_unit routing', async () => {
    const engine = createStubEngine()
    const text = await readFixture('governance.txt')

    const result = await engine.score(text)

    expect(result.flags.governance_required).toBe(true)
    expect(result.routing_recommendation).toBe('refer_ai_unit')
  })

  test('AC6: non-governance input clears governance flag and uses hands_on_session', async () => {
    const engine = createStubEngine()
    const text = await readFixture('non-governance.txt')

    const result = await engine.score(text)

    expect(result.flags.governance_required).toBe(false)
    expect(result.routing_recommendation).toBe('hands_on_session')
  })
})
