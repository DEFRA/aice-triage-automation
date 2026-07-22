describe('#submissions route', () => {
  let server

  beforeAll(async () => {
    // Dynamic import ensures MONGO_URI is already set by vitest-mongodb setup
    const { createServer } = await import('#/server.js')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  beforeEach(async () => {
    await server.db.collection('submissions').deleteMany({})
  })

  describe('POST /submissions', () => {
    test('returns 202 with empty body and stores submission as unprocessed', async () => {
      const payload = {
        submissionId: 'sub-001',
        text: 'Microsite submission text',
        submittedAt: '2026-07-22T09:15:00.000Z'
      }

      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload
      })

      expect(response.statusCode).toBe(202)
      expect(response.payload).toBe('')

      const stored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-001' })
      expect(stored.submittedAt).toBe('2026-07-22T09:15:00.000Z')
      expect(stored.status).toBe('unprocessed')
      expect(stored.receivedAt).toBeInstanceOf(Date)
    })

    test('posting the same payload twice returns 202 both times and stores one document', async () => {
      const payload = {
        submissionId: 'sub-dup-001',
        text: 'Original text',
        submittedAt: '2026-07-22T09:15:00.000Z'
      }

      const firstResponse = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload
      })

      const firstStored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-dup-001' })
      const secondResponse = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload
      })

      const secondStored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-dup-001' })

      const count = await server.db
        .collection('submissions')
        .countDocuments({ submissionId: 'sub-dup-001' })

      expect(firstResponse.statusCode).toBe(202)
      expect(secondResponse.statusCode).toBe(202)
      expect(count).toBe(1)
      expect(secondStored.text).toBe('Original text')
      expect(secondStored.submittedAt).toBe('2026-07-22T09:15:00.000Z')
      expect(secondStored.receivedAt.toISOString()).toBe(
        firstStored.receivedAt.toISOString()
      )
    })
    test('returns 400 for an empty payload object', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload: {}
      })

      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when submissionId is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload: {
          text: 'Some text',
          submittedAt: '2026-07-22T09:15:00.000Z'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when text is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload: {
          submissionId: 'sub-missing-text',
          submittedAt: '2026-07-22T09:15:00.000Z'
        }
      })

      expect(response.statusCode).toBe(400)
    })

    test('returns 400 when submittedAt is not an ISO date string', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload: {
          submissionId: 'sub-bad-date',
          text: 'Some text',
          submittedAt: 'not-a-date'
        }
      })

      expect(response.statusCode).toBe(400)
    })
    test('stores text byte-for-byte, including whitespace and newlines', async () => {
      const exactText =
        ' Keep leading spaces\nLine two with trailing spaces \n\nFinal line '

      const response = await server.inject({
        method: 'POST',
        url: '/submissions',
        payload: {
          submissionId: 'sub-raw-001',
          text: exactText,
          submittedAt: '2026-07-22T09:15:00.000Z'
        }
      })

      expect(response.statusCode).toBe(202)
      expect(response.payload).toBe('')

      const stored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-raw-001' })

      expect(stored.text).toBe(exactText)
    })
  })
})
