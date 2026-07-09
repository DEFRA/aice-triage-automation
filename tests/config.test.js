import { config } from '#/config.js'

describe('#config', () => {
  test('the scoring engine defaults to the offline stub', () => {
    expect(config.get('scoringEngine')).toBe('stub')
  })
})
describe('#config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('rejects an unknown scoring engine, naming the setting', async () => {
    vi.resetModules()
    vi.stubEnv('SCORING_ENGINE', 'nonsense')

    await expect(import('#/config.js')).rejects.toThrow(/scoringEngine/)
  })
})
