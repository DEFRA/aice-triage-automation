vi.mock('#/services/submissions.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generateSubmissionId: vi.fn(actual.generateSubmissionId)
  }
})

import { generateSubmissionId } from '#/services/submissions.js'

describe('#_dev/seed-submission route (development mode)', () => {
  let server

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LOG_ENABLED', 'false')
    vi.resetModules()

    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  beforeEach(async () => {
    await server.db.collection('submissions').deleteMany({})
    generateSubmissionId.mockClear()
  })

  describe('POST /_dev/seed-submission', () => {
    test('returns 201 with a generated unprocessed submission', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'Local test submission' }
      })

      expect(response.statusCode).toBe(201)
      expect(response.result.submissionId).toMatch(/^SUB-\d{4}-\d{4}$/)
      expect(response.result.status).toBe('unprocessed')
      expect(response.result.text).toBe('Local test submission')
    })

    test('accepts an optional submittedAt', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: {
          text: 'Local test submission',
          submittedAt: '2026-07-22T09:15:00.000Z'
        }
      })

      expect(response.statusCode).toBe(201)
      expect(response.result.submittedAt).toBe('2026-07-22T09:15:00.000Z')
    })

    test('generates sequential ids for repeat seeds', async () => {
      const first = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'first' }
      })
      const second = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'second' }
      })

      const firstSeq = Number(first.result.submissionId.split('-')[2])
      const secondSeq = Number(second.result.submissionId.split('-')[2])

      expect(secondSeq).toBe(firstSeq + 1)
    })

    test('returns 400 when text is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    test('seeded submissions appear in GET /submissions?status=unprocessed', async () => {
      await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'Local test submission' }
      })

      const response = await server.inject({
        method: 'GET',
        url: '/submissions?status=unprocessed'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toHaveLength(1)
      expect(response.result[0].text).toBe('Local test submission')
    })

    test('retries with a fresh id instead of silently returning a colliding submission', async () => {
      const first = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'existing' }
      })
      const existingId = first.result.submissionId

      // Force the next generateSubmissionId call to hand back an id that
      // already exists, simulating the race/gap scenarios the id generator
      // can't fully rule out on its own. The handler must detect the failed
      // upsert and retry rather than returning the pre-existing document.
      generateSubmissionId.mockResolvedValueOnce(existingId)

      const response = await server.inject({
        method: 'POST',
        url: '/_dev/seed-submission',
        payload: { text: 'brand new' }
      })

      expect(response.statusCode).toBe(201)
      expect(response.result.submissionId).not.toBe(existingId)
      expect(response.result.text).toBe('brand new')
    })
  })
})

describe('#_dev routes are disabled outside development', () => {
  let server

  beforeAll(async () => {
    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  test('POST /_dev/seed-submission returns 404', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/_dev/seed-submission',
      payload: { text: 'Local test submission' }
    })

    expect(response.statusCode).toBe(404)
  })
})
