import { CRITERION_KEYS } from '#/domain/rubric.js'

describe('#score route', () => {
  let server

  beforeAll(async () => {
    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  describe('POST /score', () => {
    test('returns 200 with kind opportunity and scoring for an AI use case', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score',
        payload: {
          id: 'test-01',
          text: 'We want to summarise inspection reports with an AI model.'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.result.id).toBe('test-01')
      expect(response.result.kind).toBe('opportunity')
      expect(response.result.scoring).not.toBeNull()
      expect(Object.keys(response.result.scoring.criteria)).toEqual(
        CRITERION_KEYS
      )
    })

    test('returns kind access_request and scoring null for a licence request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score',
        payload: {
          id: 'test-02',
          text: 'Please grant GitHub Copilot licences for alice@example.gov.uk, bob@example.gov.uk, carol@example.gov.uk'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.result.kind).toBe('access_request')
      expect(response.result.scoring).toBeNull()
    })

    test('returns 400 when payload is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score'
      })

      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when id is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score',
        payload: { text: 'Some text' }
      })

      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when text is an empty string', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score',
        payload: { id: 'x', text: '' }
      })

      expect(response.statusCode).toBe(400)
    })

    test('strips boilerplate before scoring', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/score',
        payload: {
          id: 'test-03',
          text: 'We want to use AI to classify waste.\n\nReply within 5 working days with one of:\na recommended pattern'
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.result.kind).toBe('opportunity')
    })
  })
})
