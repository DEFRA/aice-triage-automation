// Integration tests for the /example routes.
//
// These tests use server.inject() — Hapi's built-in HTTP simulation — so no
// real network port is needed. The in-memory MongoDB spun up by
// vitest-mongodb (see .vite/mongo-memory-server.js) is the same instance the
// server plugin connects to, so seeding via server.db is the real path.
describe('#example routes', () => {
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
    await server.db.collection('example-data').deleteMany({})
  })

  describe('GET /example', () => {
    test('Should return 200 with an empty array when the collection is empty', async () => {
      const response = await server.inject({ method: 'GET', url: '/example' })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual([])
    })

    test('Should return 200 with all documents, without _id fields', async () => {
      await server.db.collection('example-data').insertMany([
        { exampleId: 'abc', name: 'first' },
        { exampleId: 'def', name: 'second' }
      ])

      const response = await server.inject({ method: 'GET', url: '/example' })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual(
        expect.arrayContaining([
          { exampleId: 'abc', name: 'first' },
          { exampleId: 'def', name: 'second' }
        ])
      )
      response.result.forEach((item) => expect(item).not.toHaveProperty('_id'))
    })
  })

  describe('GET /example/{exampleId}', () => {
    test('Should return 200 with the matching document, without _id', async () => {
      await server.db
        .collection('example-data')
        .insertOne({ exampleId: 'abc', name: 'test' })

      const response = await server.inject({
        method: 'GET',
        url: '/example/abc'
      })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual({ exampleId: 'abc', name: 'test' })
      expect(response.result).not.toHaveProperty('_id')
    })

    test('Should return 404 when no document matches the given id', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/example/not-a-real-id'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})
