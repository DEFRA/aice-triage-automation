vi.mock('#/agents/choose-engine.js', () => ({
  chooseEngine: vi.fn()
}))

vi.mock('#/services/score-submission.js', () => ({
  scoreSubmission: vi.fn()
}))

import { chooseEngine } from '#/agents/choose-engine.js'
import { stripBoilerplate } from '#/domain/submission.js'
import { scoreSubmission } from '#/services/score-submission.js'

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
    vi.clearAllMocks()
    chooseEngine.mockReset()
    scoreSubmission.mockReset()
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

  describe('POST /submissions/{submissionId}/score', () => {
    const fakeEngine = { name: 'fake-engine' }
    const fakeResult = {
      id: 'sub-001',
      kind: 'opportunity',
      reason: 'stub reason',
      scoring: {
        criteria: {},
        routing_recommendation: 'hands_on_session',
        flags: {
          access_request: false,
          governance_required: false,
          low_confidence: false
        }
      }
    }

    test('AC1: scoring unprocessed submission returns 200 and persists scored state', async () => {
      await server.db.collection('submissions').insertOne({
        submissionId: 'sub-001',
        text: 'We want AI for triage',
        submittedAt: '2026-07-22T09:15:00.000Z',
        receivedAt: new Date('2026-07-22T09:16:00.000Z'),
        status: 'unprocessed'
      })

      chooseEngine.mockReturnValue(fakeEngine)
      scoreSubmission.mockResolvedValue(fakeResult)

      const response = await server.inject({
        method: 'POST',
        url: '/submissions/sub-001/score'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual(fakeResult)

      const stored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-001' })

      expect(stored.status).toBe('scored')
      expect(stored.result).toEqual(fakeResult)
      expect(stored.scoredAt).toBeInstanceOf(Date)
    })

    test('AC2: unknown submissionId returns 404', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/submissions/not-there/score'
      })

      expect(response.statusCode).toBe(404)
    })

    test('AC3: already scored returns stored result and does not invoke engine', async () => {
      const storedResult = {
        id: 'sub-scored',
        kind: 'opportunity',
        reason: 'already scored',
        scoring: {
          criteria: {},
          routing_recommendation: 'hands_on_session',
          flags: {
            access_request: false,
            governance_required: false,
            low_confidence: false
          }
        }
      }

      await server.db.collection('submissions').insertOne({
        submissionId: 'sub-scored',
        text: 'Raw text',
        submittedAt: '2026-07-22T09:15:00.000Z',
        receivedAt: new Date('2026-07-22T09:16:00.000Z'),
        status: 'scored',
        result: storedResult,
        scoredAt: new Date('2026-07-22T09:20:00.000Z')
      })

      const response = await server.inject({
        method: 'POST',
        url: '/submissions/sub-scored/score'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual(storedResult)
      expect(chooseEngine).not.toHaveBeenCalled()
      expect(scoreSubmission).not.toHaveBeenCalled()
    })

    test('AC4: held lock returns 409 and does not invoke engine', async () => {
      const submissionId = 'sub-locked'

      await server.db.collection('submissions').insertOne({
        submissionId,
        text: 'Raw text',
        submittedAt: '2026-07-22T09:15:00.000Z',
        receivedAt: new Date('2026-07-22T09:16:00.000Z'),
        status: 'unprocessed'
      })

      const heldLock = await server.locker.lock(submissionId)
      expect(heldLock).toBeTruthy()

      try {
        const response = await server.inject({
          method: 'POST',
          url: '/submissions/sub-locked/score'
        })

        expect(response.statusCode).toBe(409)
        expect(chooseEngine).not.toHaveBeenCalled()
        expect(scoreSubmission).not.toHaveBeenCalled()
      } finally {
        await heldLock.free()
      }
    })

    test('AC5: score uses stripped text while raw text remains unchanged in DB', async () => {
      const rawText =
        'We want to use AI to classify waste.\n\nReply within 5 working days with one of:\na recommended pattern'

      await server.db.collection('submissions').insertOne({
        submissionId: 'sub-strip',
        text: rawText,
        submittedAt: '2026-07-22T09:15:00.000Z',
        receivedAt: new Date('2026-07-22T09:16:00.000Z'),
        status: 'unprocessed'
      })

      chooseEngine.mockReturnValue(fakeEngine)
      scoreSubmission.mockResolvedValue(fakeResult)

      const response = await server.inject({
        method: 'POST',
        url: '/submissions/sub-strip/score'
      })

      expect(response.statusCode).toBe(200)
      expect(scoreSubmission).toHaveBeenCalledWith(fakeEngine, {
        id: 'sub-strip',
        text: stripBoilerplate(rawText)
      })

      const stored = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-strip' })

      expect(stored.text).toBe(rawText)
      expect(stored.result).toEqual(fakeResult)
    })

    test('optional: scoring failure leaves submission unprocessed and lock is released', async () => {
      await server.db.collection('submissions').insertOne({
        submissionId: 'sub-fail',
        text: 'Some raw text',
        submittedAt: '2026-07-22T09:15:00.000Z',
        receivedAt: new Date('2026-07-22T09:16:00.000Z'),
        status: 'unprocessed'
      })

      chooseEngine.mockReturnValue(fakeEngine)
      scoreSubmission.mockRejectedValueOnce(new Error('engine failed'))

      const first = await server.inject({
        method: 'POST',
        url: '/submissions/sub-fail/score'
      })

      expect(first.statusCode).toBe(500)

      const afterFail = await server.db
        .collection('submissions')
        .findOne({ submissionId: 'sub-fail' })

      expect(afterFail.status).toBe('unprocessed')
      expect(afterFail.scoredAt).toBeUndefined()
      expect(afterFail.result).toBeUndefined()

      scoreSubmission.mockResolvedValueOnce(fakeResult)

      const second = await server.inject({
        method: 'POST',
        url: '/submissions/sub-fail/score'
      })

      expect(second.statusCode).toBe(200)
    })
  })
})
