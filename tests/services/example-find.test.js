// Unit tests for the example-find service.
//
// The service functions take a MongoDB `db` object directly — there is no
// HTTP layer involved. Tests connect their own MongoClient to the same
// in-memory server used by the rest of the suite (MONGO_URI is set by
// vitest-mongodb in .vite/mongo-memory-server.js) so the tests are fully
// isolated from the running Hapi server.
import { MongoClient } from 'mongodb'
import { findAllExampleData, findExampleData } from '#/services/example-find.js'

describe('#example-find', () => {
  let client
  let db

  beforeAll(async () => {
    client = await MongoClient.connect(process.env.MONGO_URI)
    db = client.db('aice-triage-automation')
  })

  afterAll(async () => {
    await client.close()
  })

  beforeEach(async () => {
    await db.collection('example-data').deleteMany({})
  })

  describe('findAllExampleData', () => {
    test('Should return an empty array when the collection is empty', async () => {
      const result = await findAllExampleData(db)

      expect(result).toEqual([])
    })

    test('Should return all documents without _id fields', async () => {
      await db.collection('example-data').insertMany([
        { exampleId: 'abc', name: 'first' },
        { exampleId: 'def', name: 'second' }
      ])

      const result = await findAllExampleData(db)

      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          { exampleId: 'abc', name: 'first' },
          { exampleId: 'def', name: 'second' }
        ])
      )
      result.forEach((item) => expect(item).not.toHaveProperty('_id'))
    })
  })

  describe('findExampleData', () => {
    test('Should return null when no document matches the given id', async () => {
      const result = await findExampleData(db, 'not-a-real-id')

      expect(result).toBeNull()
    })

    test('Should return the matching document without an _id field', async () => {
      await db
        .collection('example-data')
        .insertOne({ exampleId: 'abc', name: 'test' })

      const result = await findExampleData(db, 'abc')

      expect(result).toEqual({ exampleId: 'abc', name: 'test' })
      expect(result).not.toHaveProperty('_id')
    })
  })
})
