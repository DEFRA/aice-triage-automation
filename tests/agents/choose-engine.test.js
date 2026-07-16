import { describe, test, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('#agents/choose-engine', () => {
  test('AC1: returns stub engine when scoringEngine is stub', async () => {
    vi.stubEnv('SCORING_ENGINE', 'stub')
    vi.resetModules()

    const { chooseEngine } = await import('#/agents/choose-engine.js')
    const engine = chooseEngine()

    expect(engine.name).toBe('stub')
  })

  test('AC1: returns bedrock engine when scoringEngine is bedrock', async () => {
    vi.stubEnv('SCORING_ENGINE', 'bedrock')
    vi.stubEnv('BEDROCK_REGION', 'eu-west-2')
    vi.stubEnv('BEDROCK_SCORE_MODEL_ID', 'score-model-id')
    vi.stubEnv('BEDROCK_CLASSIFY_MODEL_ID', 'classify-model-id')
    vi.resetModules()

    const { chooseEngine } = await import('#/agents/choose-engine.js')
    const engine = chooseEngine()

    expect(engine.name).toBe('bedrock')
  })

  test('AC2: with no env vars, returns stub engine by default', async () => {
    vi.resetModules()

    const { chooseEngine } = await import('#/agents/choose-engine.js')
    const engine = chooseEngine()

    expect(engine.name).toBe('stub')
  })

  test('AC5: bedrock selection fails fast when score model id is missing', async () => {
    vi.stubEnv('SCORING_ENGINE', 'bedrock')
    vi.stubEnv('BEDROCK_REGION', 'eu-west-2')
    vi.stubEnv('BEDROCK_SCORE_MODEL_ID', '')
    vi.stubEnv('BEDROCK_CLASSIFY_MODEL_ID', 'classify-model-id')
    vi.resetModules()

    const { chooseEngine } = await import('#/agents/choose-engine.js')

    expect(() => chooseEngine()).toThrow(/bedrock\.scoreModelId/)
  })

  test('AC5: bedrock selection fails fast when classify model id is missing', async () => {
    vi.stubEnv('SCORING_ENGINE', 'bedrock')
    vi.stubEnv('BEDROCK_REGION', 'eu-west-2')
    vi.stubEnv('BEDROCK_SCORE_MODEL_ID', 'score-model-id')
    vi.stubEnv('BEDROCK_CLASSIFY_MODEL_ID', '')
    vi.resetModules()

    const { chooseEngine } = await import('#/agents/choose-engine.js')

    expect(() => chooseEngine()).toThrow(/bedrock\.classifyModelId/)
  })
})
