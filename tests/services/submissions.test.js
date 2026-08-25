import { MongoClient } from 'mongodb'
import { RUBRIC_VERSION } from '#/domain/rubric.js'
import {
  insertSubmission,
  findSubmissions,
  findSubmission,
  markScored,
  generateSubmissionId
} from '#/services/submissions.js'
import { createIndexes } from '#/plugins/mongodb.js'

describe('#services/submissions', () => {
  let client
  let db

  beforeAll(async () => {
    client = await MongoClient.connect(process.env.MONGO_URI)
    db = client.db('aice-triage-automation')
    await createIndexes(db)
  })

  afterAll(async () => {
    await client.close()
  })

  beforeEach(async () => {
    await db.collection('submissions').deleteMany({})
  })

  test('AC1: insertSubmission stores unprocessed with server-side receivedAt', async () => {
    const callerReceivedAt = new Date('2000-01-01T00:00:00.000Z')

    await insertSubmission(db, {
      submissionId: 'sub-001',
      text: 'raw text as sent',
      submittedAt: '2026-07-22T09:15:00.000Z',
      receivedAt: callerReceivedAt
    })

    const stored = await db
      .collection('submissions')
      .findOne({ submissionId: 'sub-001' })

    expect(stored.submissionId).toBe('sub-001')
    expect(stored.text).toBe('raw text as sent')
    expect(stored.submittedAt).toBe('2026-07-22T09:15:00.000Z')
    expect(stored.status).toBe('unprocessed')
    expect(stored.receivedAt).toBeInstanceOf(Date)
    expect(stored.receivedAt.toISOString()).not.toBe(
      callerReceivedAt.toISOString()
    )
  })

  test('AC2: duplicate insertSubmission keeps exactly one unchanged document', async () => {
    await insertSubmission(db, {
      submissionId: 'sub-dup',
      text: 'original text',
      submittedAt: '2026-07-22T09:15:00.000Z'
    })

    const first = await db
      .collection('submissions')
      .findOne({ submissionId: 'sub-dup' })

    await insertSubmission(db, {
      submissionId: 'sub-dup',
      text: 'changed text should be ignored',
      submittedAt: '2030-01-01T00:00:00.000Z'
    })

    const second = await db
      .collection('submissions')
      .findOne({ submissionId: 'sub-dup' })

    const count = await db
      .collection('submissions')
      .countDocuments({ submissionId: 'sub-dup' })

    expect(count).toBe(1)
    expect(second.text).toBe('original text')
    expect(second.submittedAt).toBe('2026-07-22T09:15:00.000Z')
    expect(second.receivedAt.toISOString()).toBe(first.receivedAt.toISOString())
  })

  test('AC3: findSubmissions returns unprocessed only, newest first, no _id', async () => {
    await db.collection('submissions').insertMany([
      {
        submissionId: 'old-unprocessed',
        text: 'a',
        submittedAt: '2026-07-22T09:00:00.000Z',
        receivedAt: new Date('2026-07-22T09:00:00.000Z'),
        status: 'unprocessed'
      },
      {
        submissionId: 'processed-one',
        text: 'b',
        submittedAt: '2026-07-22T09:30:00.000Z',
        receivedAt: new Date('2026-07-22T09:30:00.000Z'),
        status: 'processed'
      },
      {
        submissionId: 'new-unprocessed',
        text: 'c',
        submittedAt: '2026-07-22T10:00:00.000Z',
        receivedAt: new Date('2026-07-22T10:00:00.000Z'),
        status: 'unprocessed'
      }
    ])

    const result = await findSubmissions(db, { status: 'unprocessed' })

    expect(result.map((x) => x.submissionId)).toEqual([
      'new-unprocessed',
      'old-unprocessed'
    ])
    result.forEach((item) => expect(item).not.toHaveProperty('_id'))
  })

  test('AC4: findSubmission returns one document or null', async () => {
    await db.collection('submissions').insertOne({
      submissionId: 'sub-xyz',
      text: 'stored text',
      submittedAt: '2026-07-22T09:15:00.000Z',
      receivedAt: new Date('2026-07-22T09:16:00.000Z'),
      status: 'unprocessed'
    })

    const found = await findSubmission(db, 'sub-xyz')
    const missing = await findSubmission(db, 'does-not-exist')

    expect(found).toEqual({
      submissionId: 'sub-xyz',
      text: 'stored text',
      submittedAt: '2026-07-22T09:15:00.000Z',
      receivedAt: new Date('2026-07-22T09:16:00.000Z'),
      status: 'unprocessed'
    })
    expect(found).not.toHaveProperty('_id')
    expect(missing).toBeNull()
  })

  test('story 33 AC3: a scored submission records the rubric version it was scored against', async () => {
    await insertSubmission(db, {
      submissionId: 'sub-versioned',
      text: 'raw text as sent',
      submittedAt: '2026-07-22T09:15:00.000Z'
    })

    await markScored(db, 'sub-versioned', {
      id: 'sub-versioned',
      kind: 'opportunity',
      reason: 'AI use case.',
      scoring: {
        criteria: {},
        routing_recommendation: 'hands_on_session',
        flags: {
          access_request: false,
          governance_required: false,
          low_confidence: false
        },
        rubric_version: RUBRIC_VERSION
      }
    })

    const stored = await findSubmission(db, 'sub-versioned')

    expect(stored.status).toBe('scored')
    expect(stored.result.scoring.rubric_version).toBe(RUBRIC_VERSION)
  })

  test('AC5: createIndexes creates unique submissionId and status indexes', async () => {
    const indexes = await db.collection('submissions').indexes()

    const submissionIdIndex = indexes.find((idx) => idx.key?.submissionId === 1)
    const statusIndex = indexes.find((idx) => idx.key?.status === 1)

    expect(submissionIdIndex).toBeDefined()
    expect(submissionIdIndex.unique).toBe(true)
    expect(statusIndex).toBeDefined()
  })

  describe('generateSubmissionId', () => {
    test('returns a SUB-YYYY-NNNN id for the given date', async () => {
      const id = await generateSubmissionId(
        db,
        new Date('2026-01-01T00:00:00.000Z')
      )

      expect(id).toBe('SUB-2026-0001')
    })

    test('increments the sequence for existing submissions in the same year', async () => {
      await db.collection('submissions').insertMany([
        {
          submissionId: 'SUB-2026-0001',
          text: 'a',
          status: 'unprocessed',
          receivedAt: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          submissionId: 'SUB-2026-0002',
          text: 'b',
          status: 'unprocessed',
          receivedAt: new Date('2026-01-02T00:00:00.000Z')
        }
      ])

      const id = await generateSubmissionId(
        db,
        new Date('2026-06-01T00:00:00.000Z')
      )

      expect(id).toBe('SUB-2026-0003')
    })

    test('starts a fresh sequence for a different year', async () => {
      await db.collection('submissions').insertOne({
        submissionId: 'SUB-2025-0009',
        text: 'a',
        status: 'unprocessed',
        receivedAt: new Date('2025-01-01T00:00:00.000Z')
      })

      const id = await generateSubmissionId(
        db,
        new Date('2026-01-01T00:00:00.000Z')
      )

      expect(id).toBe('SUB-2026-0001')
    })

    test('does not collide when an earlier id in the sequence has been deleted', async () => {
      // SUB-2026-0002 deleted after being seeded and removed, leaving a gap.
      await db.collection('submissions').insertMany([
        {
          submissionId: 'SUB-2026-0001',
          text: 'a',
          status: 'unprocessed',
          receivedAt: new Date('2026-01-01T00:00:00.000Z')
        },
        {
          submissionId: 'SUB-2026-0003',
          text: 'c',
          status: 'unprocessed',
          receivedAt: new Date('2026-01-03T00:00:00.000Z')
        }
      ])

      const id = await generateSubmissionId(
        db,
        new Date('2026-06-01T00:00:00.000Z')
      )

      expect(id).toBe('SUB-2026-0004')
    })

    test('ignores ids with a longer sequence suffix when computing the next one', async () => {
      await db.collection('submissions').insertOne({
        submissionId: 'SUB-2026-00019',
        text: 'a',
        status: 'unprocessed',
        receivedAt: new Date('2026-01-01T00:00:00.000Z')
      })

      const id = await generateSubmissionId(
        db,
        new Date('2026-06-01T00:00:00.000Z')
      )

      expect(id).toBe('SUB-2026-0001')
    })
  })
})
