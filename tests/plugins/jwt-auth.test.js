import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { ProxyAgent } from 'undici'

import hapi from '@hapi/hapi'

import {
  bearerToken,
  createKeySet,
  jwtAuth,
  keySetFetch
} from '#/plugins/jwt-auth.js'

// No test touches AWS. A key pair is generated here, tokens are signed with it,
// and the plugin is handed the matching public key set through its options —
// the seam `createServer({ auth: { keySet } })` exists for exactly this.

const AWS_ACCOUNT = '123456789012'
const ISSUER = 'https://oidc.test.invalid'
const AUDIENCE = 'aice-triage-automation'
const CALLER = 'service-manual-ui'
const SUBJECT = `arn:aws:iam::${AWS_ACCOUNT}:role/${CALLER}`

const now = () => Math.floor(Date.now() / 1000)

let rsaKeys
let ecKeys
let keySet

async function signToken(overrides = {}) {
  const {
    key = rsaKeys.privateKey,
    alg = 'RS256',
    kid = 'rsa-1',
    issuer = ISSUER,
    audience = AUDIENCE,
    subject = SUBJECT,
    issuedAt = now(),
    expiresAt = now() + 300,
    serviceName = CALLER
  } = overrides

  return new SignJWT({
    'https://sts.amazonaws.com/': {
      principal_tags: { ServiceName: [serviceName] }
    }
  })
    .setProtectedHeader({ alg, kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key)
}

async function startServer(auth = {}) {
  // Dynamic import ensures MONGO_URI is already set by vitest-mongodb setup
  const { createServer } = await import('#/server.js')
  const server = await createServer({
    auth: {
      audience: AUDIENCE,
      issuer: ISSUER,
      awsAccount: AWS_ACCOUNT,
      allowedCallers: [CALLER],
      keySet,
      ...auth
    }
  })

  await server.initialize()

  return server
}

// Logging is disabled under test, so the audit-mode assertions need a logger of
// their own. hapi-pino assigns `request.logger` rather than decorating it, and
// onPreAuth runs before the strategy, so the swap holds for the request.
function captureLogs(server) {
  const entries = []
  const record = (level) => (data, message) =>
    entries.push({ level, data, message })

  server.ext('onPreAuth', (request, h) => {
    request.logger = {
      debug: record('debug'),
      info: record('info'),
      warn: record('warn'),
      error: record('error')
    }

    return h.continue
  })

  return entries
}

// The boot line is logged during plugin registration, before any request
// exists, so it needs a bare server with a logger of its own rather than the
// request-level swap above.
async function registerOn(bare, options = {}) {
  const lines = []

  bare.decorate('server', 'logger', {
    info: (data, message) => lines.push({ data, message })
  })

  await bare.register({
    plugin: jwtAuth,
    options: {
      mode: 'off',
      audience: AUDIENCE,
      issuer: '',
      jwksUri: '',
      awsAccount: '',
      allowedCallers: [CALLER],
      httpProxy: null,
      keySet,
      ...options
    }
  })

  return lines
}

function post(server, { token, submissionId }) {
  return server.inject({
    method: 'POST',
    url: '/submissions',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: {
      submissionId,
      text: 'Problem: we triage by hand',
      submittedAt: '2026-08-25T09:15:00.000Z'
    }
  })
}

beforeAll(async () => {
  rsaKeys = await generateKeyPair('RS256', { extractable: true })
  ecKeys = await generateKeyPair('ES256', { extractable: true })

  keySet = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(rsaKeys.publicKey)), alg: 'RS256', kid: 'rsa-1' },
      { ...(await exportJWK(ecKeys.publicKey)), alg: 'ES256', kid: 'ec-1' }
    ]
  })
})

describe('#jwt-auth: off', () => {
  let server

  beforeAll(async () => {
    server = await startServer({ mode: 'off' })
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  beforeEach(async () => {
    await server.db.collection('submissions').deleteMany({})
  })

  test('stores the submission with no Authorization header at all', async () => {
    const response = await post(server, { submissionId: 'off-none' })

    expect(response.statusCode).toBe(202)

    const stored = await server.db
      .collection('submissions')
      .findOne({ submissionId: 'off-none' })

    expect(stored.status).toBe('unprocessed')
  })

  test('does not look at the header: nonsense in it is still 202', async () => {
    const response = await post(server, {
      submissionId: 'off-nonsense',
      token: 'not-a-jwt'
    })

    expect(response.statusCode).toBe(202)
  })
})

describe('#jwt-auth: audit', () => {
  let server
  let logs

  beforeAll(async () => {
    server = await startServer({ mode: 'audit' })
    logs = captureLogs(server)
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  beforeEach(async () => {
    await server.db.collection('submissions').deleteMany({})
    logs.length = 0
  })

  test('a valid token is accepted and logged with its subject', async () => {
    const response = await post(server, {
      submissionId: 'audit-valid',
      token: await signToken()
    })

    expect(response.statusCode).toBe(202)

    const entry = logs.find((log) => log.message === 'caller authenticated')

    expect(entry.level).toBe('info')
    expect(entry.data.auth.subject).toBe(SUBJECT)
    expect(entry.data.auth.serviceName).toBe(CALLER)
  })

  // The point of the mode: the request is served either way, so the log is the
  // only evidence. Assert on the log, not on the status code alone.
  test('a missing token is logged and the submission is still stored', async () => {
    const response = await post(server, { submissionId: 'audit-none' })

    expect(response.statusCode).toBe(202)

    const stored = await server.db
      .collection('submissions')
      .findOne({ submissionId: 'audit-none' })

    expect(stored.status).toBe('unprocessed')

    const entry = logs.find(
      (log) => log.message === 'caller failed authentication'
    )

    expect(entry.level).toBe('warn')
    expect(entry.data.auth.reason).toBe('no_bearer_token')
  })

  test('an expired token is logged with the reason and still served', async () => {
    const response = await post(server, {
      submissionId: 'audit-expired',
      token: await signToken({ issuedAt: now() - 600, expiresAt: now() - 300 })
    })

    expect(response.statusCode).toBe(202)

    const entry = logs.find(
      (log) => log.message === 'caller failed authentication'
    )

    expect(entry.data.auth.reason).toBe('ERR_JWT_EXPIRED')
  })

  test('an unlisted caller is logged by subject and still served', async () => {
    const response = await post(server, {
      submissionId: 'audit-unlisted',
      token: await signToken({
        subject: `arn:aws:iam::${AWS_ACCOUNT}:role/some-other-service`,
        serviceName: 'some-other-service'
      })
    })

    expect(response.statusCode).toBe(202)

    const entry = logs.find(
      (log) => log.message === 'caller failed authentication'
    )

    expect(entry.data.auth.reason).toBe('caller_not_allowed')
    expect(entry.data.auth.serviceName).toBe('some-other-service')
  })
})

describe('#jwt-auth: enforce', () => {
  let server

  beforeAll(async () => {
    server = await startServer({ mode: 'enforce' })
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  beforeEach(async () => {
    await server.db.collection('submissions').deleteMany({})
  })

  test('a valid token is accepted and the submission is stored', async () => {
    const response = await post(server, {
      submissionId: 'enforce-valid',
      token: await signToken()
    })

    expect(response.statusCode).toBe(202)
    expect(response.payload).toBe('')

    const stored = await server.db
      .collection('submissions')
      .findOne({ submissionId: 'enforce-valid' })

    expect(stored.status).toBe('unprocessed')
    expect(stored.text).toBe('Problem: we triage by hand')
  })

  test.each([
    ['no Authorization header', () => Promise.resolve(undefined)],
    ['a malformed token', () => Promise.resolve('not-a-jwt')],
    ['the wrong audience', () => signToken({ audience: 'somebody-else' })],
    [
      'the wrong issuer',
      () => signToken({ issuer: 'https://elsewhere.invalid' })
    ],
    [
      'an expired token',
      () => signToken({ issuedAt: now() - 600, expiresAt: now() - 300 })
    ],
    [
      'the wrong algorithm',
      () => signToken({ key: ecKeys.privateKey, alg: 'ES256', kid: 'ec-1' })
    ],
    [
      'a signature from an unknown key',
      async () => {
        const stranger = await generateKeyPair('RS256', { extractable: true })
        return signToken({ key: stranger.privateKey, kid: 'rsa-9' })
      }
    ]
  ])('rejects %s with 401 and stores nothing', async (_name, makeToken) => {
    const response = await post(server, {
      submissionId: 'enforce-rejected',
      token: await makeToken()
    })

    expect(response.statusCode).toBe(401)

    const count = await server.db
      .collection('submissions')
      .countDocuments({ submissionId: 'enforce-rejected' })

    expect(count).toBe(0)
  })

  test('a valid token from an unlisted caller is 403, not 401', async () => {
    const response = await post(server, {
      submissionId: 'enforce-unlisted',
      token: await signToken({
        subject: `arn:aws:iam::${AWS_ACCOUNT}:role/some-other-service`
      })
    })

    expect(response.statusCode).toBe(403)

    const count = await server.db
      .collection('submissions')
      .countDocuments({ submissionId: 'enforce-unlisted' })

    expect(count).toBe(0)
  })

  test('the same caller in another AWS account is 403', async () => {
    const response = await post(server, {
      submissionId: 'enforce-wrong-account',
      token: await signToken({
        subject: `arn:aws:iam::999999999999:role/${CALLER}`
      })
    })

    expect(response.statusCode).toBe(403)
  })
})

// The plan leaves this open; this is the answer taken. A JWKS endpoint that is
// unreachable is our fault, not the caller's, and 401 would send whoever is
// debugging it after a token that was fine.
describe('#jwt-auth: the key set is unreachable', () => {
  let server
  let logs

  beforeAll(async () => {
    server = await startServer({
      mode: 'enforce',
      keySet: () => {
        throw Object.assign(new Error('Timeout fetching the JWKS'), {
          code: 'ERR_JWKS_TIMEOUT'
        })
      }
    })
    logs = captureLogs(server)
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  test('answers 503, not 401, and says so in the log', async () => {
    const response = await post(server, {
      submissionId: 'jwks-down',
      token: await signToken()
    })

    expect(response.statusCode).toBe(503)

    const entry = logs.find(
      (log) => log.message === 'caller failed authentication'
    )

    expect(entry.data.auth.reason).toBe('key_set_unavailable')
    expect(entry.data.auth.detail).toBe('Timeout fetching the JWKS')
  })
})

describe('#jwt-auth: the unprotected routes', () => {
  let server

  beforeAll(async () => {
    server = await startServer({ mode: 'enforce' })

    await server.db.collection('submissions').deleteMany({})
    await server.db.collection('submissions').insertOne({
      submissionId: 'open-001',
      text: 'Stored submission',
      submittedAt: '2026-08-25T09:15:00.000Z',
      receivedAt: new Date('2026-08-25T09:16:00.000Z'),
      status: 'unprocessed'
    })
  })

  afterAll(async () => {
    await server.stop({ timeout: 1000 })
  })

  // Applying the strategy per route rather than as a default means a route
  // added later is open unless somebody remembers. This is the record of which
  // routes that currently describes.
  test.each([
    ['GET', '/health', 200],
    ['GET', '/submissions?status=unprocessed', 200],
    ['GET', '/submissions/open-001', 200]
  ])('%s %s is unaffected by enforce mode', async (method, url, expected) => {
    const response = await server.inject({ method, url })

    expect(response.statusCode).toBe(expected)
  })

  test('POST /submissions/{id}/score is reached without a token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/submissions/not-there/score'
    })

    // 404 rather than 401: the request got as far as the handler.
    expect(response.statusCode).toBe(404)
  })
})

describe('#bearerToken', () => {
  test('reads the token out of a bearer header', () => {
    expect(bearerToken({ authorization: 'Bearer abc.def.ghi' })).toBe(
      'abc.def.ghi'
    )
  })

  // RFC 7235 makes the scheme name case-insensitive. Rejecting a lower-case
  // one would be a 401 nobody would think to look for.
  test('accepts any casing of the scheme name', () => {
    expect(bearerToken({ authorization: 'bearer abc' })).toBe('abc')
    expect(bearerToken({ authorization: 'BEARER abc' })).toBe('abc')
  })

  test('returns null for no header, another scheme, or an empty token', () => {
    expect(bearerToken({})).toBeNull()
    expect(bearerToken({ authorization: 'Basic dXNlcjpwYXNz' })).toBeNull()
    expect(bearerToken({ authorization: 'Bearer ' })).toBeNull()
  })
})

// The one thing the plan is most emphatic about: the key fetch must go through
// the forward proxy, or it hangs in every deployed environment. Assert on the
// dispatcher rather than on a network call.
describe('#keySetFetch', () => {
  test('sends the request through a ProxyAgent when HTTP_PROXY is set', async () => {
    const fetchImpl = vi.fn().mockResolvedValue('response')
    const proxied = keySetFetch('http://localhost:3128', fetchImpl)

    await proxied('https://keys.test.invalid/jwks', { method: 'GET' })

    const [url, init] = fetchImpl.mock.calls[0]

    expect(url).toBe('https://keys.test.invalid/jwks')
    expect(init.method).toBe('GET')
    expect(init.dispatcher).toBeInstanceOf(ProxyAgent)

    await init.dispatcher.close()
  })

  test('leaves jose to its own fetch when there is no proxy', () => {
    expect(keySetFetch(null)).toBeUndefined()
    expect(keySetFetch('')).toBeUndefined()
  })
})

describe('#createKeySet', () => {
  // createRemoteJWKSet is lazy, so building one reaches nothing.
  test('builds a resolver without fetching anything', () => {
    expect(
      typeof createKeySet({
        jwksUri: 'https://keys.test.invalid/jwks',
        httpProxy: null
      })
    ).toBe('function')
  })

  test('fails loudly on a jwksUri that is not a URL', () => {
    expect(() =>
      createKeySet({ jwksUri: 'not a url', httpProxy: null })
    ).toThrow()
  })
})

// Items 3 and 7 of the plan's verification list cannot be answered from a
// portal terminal: that terminal runs in its own container and shows a curated
// slice of platform variables rather than this service's environment. This line
// is where the answer comes from, in every environment, as the rollout reaches
// it.
describe('what reached the running service', () => {
  test('reports each platform setting as present or absent', async () => {
    const lines = await registerOn(hapi.server(), {
      issuer: ISSUER,
      jwksUri: 'https://oidc.test.invalid/keys',
      awsAccount: AWS_ACCOUNT,
      httpProxy: 'http://127.0.0.1:3128'
    })

    expect(lines).toHaveLength(1)
    expect(lines[0].message).toBe('Service-to-service authentication is off')
    expect(lines[0].data.auth).toEqual({
      mode: 'off',
      issuer: true,
      jwksUri: true,
      awsAccount: true,
      httpProxy: true
    })
  })

  test('reports the absent ones as false rather than omitting them', async () => {
    const lines = await registerOn(hapi.server())

    expect(lines[0].data.auth).toEqual({
      mode: 'off',
      issuer: false,
      jwksUri: false,
      awsAccount: false,
      httpProxy: false
    })
  })

  // Presence, never values: this line goes to the platform's log store, and an
  // issuer or an account number there is a detail nobody asked it to keep.
  test('carries no value from any setting it reports on', async () => {
    const lines = await registerOn(hapi.server(), {
      issuer: ISSUER,
      jwksUri: 'https://oidc.test.invalid/keys',
      awsAccount: AWS_ACCOUNT,
      httpProxy: 'http://127.0.0.1:3128'
    })

    const logged = JSON.stringify(lines[0])

    expect(logged).not.toContain(ISSUER)
    expect(logged).not.toContain(AWS_ACCOUNT)
    expect(logged).not.toContain('3128')
  })
})
