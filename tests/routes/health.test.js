describe('#health route', () => {
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

  describe('GET /health', () => {
    test('Should return 200 with a success message', async () => {
      const response = await server.inject({ method: 'GET', url: '/health' })

      expect(response.statusCode).toBe(200)
      expect(response.result).toEqual({ message: 'success' })
    })
  })
})
