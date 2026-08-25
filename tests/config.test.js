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

  test('redacts req, res and responseTime when NODE_ENV is not production', () => {
    expect(config.get('log.redact')).toEqual(['req', 'res', 'responseTime'])
  })

  // The binding is operator control, not a fix: the defradigital base images set
  // NODE_ENV themselves, so a deployed container already takes the narrow list.
  // LOG_REDACT is what lets an environment change it from cdp-app-config.
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

  test('service-to-service authentication is off unless an environment asks', () => {
    expect(config.get('auth.mode')).toBe('off')
    expect(config.get('auth.audience')).toBe('aice-triage-automation')
    expect(config.get('auth.allowedCallers')).toEqual(['service-manual-ui'])
  })

  test('rejects an unknown AUTH_MODE, naming the setting', async () => {
    vi.stubEnv('AUTH_MODE', 'on')
    await expect(import('#/config.js')).rejects.toThrow(/auth\.mode/)
  })

  // The platform sets these three; nothing sets them locally. Failing at boot
  // says so once, rather than turning every intake request into a 401.
  test('rejects a mode other than off without the platform settings', async () => {
    vi.stubEnv('AUTH_MODE', 'enforce')
    await expect(import('#/config.js')).rejects.toThrow(
      /auth\.issuer, auth\.jwksUri, auth\.awsAccount/
    )
  })

  test('accepts audit mode once the platform settings are present', async () => {
    vi.stubEnv('AUTH_MODE', 'audit')
    vi.stubEnv('CDP_JWT_ISSUER', 'https://oidc.test.invalid')
    vi.stubEnv('CDP_JWT_JWKS_URI', 'https://oidc.test.invalid/keys')
    vi.stubEnv('AWS_ACCOUNT', '123456789012')
    vi.stubEnv('AUTH_ALLOWED_CALLERS', 'service-manual-ui,aice-triage-frontend')

    const { config } = await import('#/config.js')

    expect(config.get('auth.mode')).toBe('audit')
    expect(config.get('auth.allowedCallers')).toEqual([
      'service-manual-ui',
      'aice-triage-frontend'
    ])
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
