import { afterEach, describe, expect, test, vi } from 'vitest'
import { config } from '#/config.js'

describe('#config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('the scoring engine defaults to the offline stub', () => {
    expect(config.get('scoringEngine')).toBe('stub')
  })

  test('rejects an unknown scoring engine, naming the setting', async () => {
    vi.stubEnv('SCORING_ENGINE', 'nonsense')
    await expect(import('#/config.js')).rejects.toThrow(/scoringEngine/)
  })

  test('rejects invalid BEDROCK_GUARDRAIL_VERSION', async () => {
    vi.stubEnv('BEDROCK_GUARDRAIL_VERSION', 'abc')
    await expect(import('#/config.js')).rejects.toThrow(/guardrailVersion/)
  })

  test('accepts DRAFT guardrail version', async () => {
    vi.stubEnv('BEDROCK_GUARDRAIL_VERSION', 'DRAFT')
    const { config } = await import('#/config.js')
    expect(config.get('bedrock.guardrailVersion')).toBe('DRAFT')
  })
  test('rejects guardrailId without guardrailVersion', async () => {
    vi.stubEnv('BEDROCK_GUARDRAIL_ID', 'gr-123')
    vi.stubEnv('BEDROCK_GUARDRAIL_VERSION', '')
    await expect(import('#/config.js')).rejects.toThrow(
      /guardrailId|guardrailVersion/
    )
  })

  test('isDevelopment is false by default (NODE_ENV=test)', () => {
    expect(config.get('isDevelopment')).toBe(false)
  })

  test('isDevelopment is true when NODE_ENV=development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { config: devConfig } = await import('#/config.js')
    expect(devConfig.get('isDevelopment')).toBe(true)
  })
})
