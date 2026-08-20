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

  test('redacts req, res and responseTime by default off CDP', () => {
    expect(config.get('log.redact')).toEqual(['req', 'res', 'responseTime'])
  })

  // Without this binding a deployed service is stuck with the NODE_ENV-chosen
  // default, and CDP never sets NODE_ENV — so its logs would carry no URL, no
  // status code and no timing, with no way to fix it from cdp-app-config.
  test('takes the redact list from LOG_REDACT, splitting on commas', async () => {
    vi.stubEnv(
      'LOG_REDACT',
      'req.headers.authorization,req.headers.cookie,res.headers'
    )
    const { config } = await import('#/config.js')
    expect(config.get('log.redact')).toEqual([
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers'
    ])
  })

  test('rejects guardrailId without guardrailVersion', async () => {
    vi.stubEnv('BEDROCK_GUARDRAIL_ID', 'gr-123')
    vi.stubEnv('BEDROCK_GUARDRAIL_VERSION', '')
    await expect(import('#/config.js')).rejects.toThrow(
      /guardrailId|guardrailVersion/
    )
  })
})
