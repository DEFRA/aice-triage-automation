import Boom from '@hapi/boom'
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

import {
  allowedSubjects,
  callerServiceName,
  isAllowedCaller
} from '#/common/helpers/auth/allowed-callers.js'

// Codes jose raises when the *token* is the problem: it is malformed, expired,
// signed with the wrong key or algorithm, or claims the wrong issuer or
// audience. Anything else that escapes `jwtVerify` — a timeout fetching the
// public keys, a proxy refusing the connection — is our problem, not the
// caller's, and answering it with 401 would read as an authentication bug on a
// caller that did nothing wrong. Those become 503.
const TOKEN_ERROR_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_INVALID',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID'
])

// The scheme name is case-insensitive per RFC 7235. Being strict here would
// reject a legitimate caller for a reason nobody would think to look for.
const BEARER = /^Bearer[ \t]+(.+)$/i

/**
 * The token from an `Authorization: Bearer …` header.
 *
 * @param {object} headers The request headers.
 * @returns {string|null} The token, or null when there is no bearer header.
 */
export function bearerToken(headers) {
  const match = BEARER.exec(headers.authorization ?? '')

  return match ? match[1] : null
}

/**
 * All outbound egress on the platform goes through the forward proxy, and the
 * public keys live outside it, under `*.tokens.sts.global.api.aws`. Nothing in
 * this service sets a global dispatcher, so the key fetch gets its own proxied
 * client whenever `HTTP_PROXY` is set — deployed environments, and no local one.
 *
 * Deployed environments also set `NODE_USE_ENV_PROXY=1`, which would route a
 * plain `fetch` through the proxy anyway. This does not rely on that: it is one
 * environment variable in `cdp-app-config` away from silently going direct, and
 * a JWKS fetch that goes direct hangs until the request times out.
 *
 * @param {string|null} httpProxy The forward proxy URL, or null.
 * @param {Function} [fetchImpl] Seam for the test that checks the dispatcher.
 * @returns {Function|undefined} A fetch for jose, or undefined to use its own.
 */
export function keySetFetch(httpProxy, fetchImpl = undiciFetch) {
  if (!httpProxy) return undefined

  const dispatcher = new ProxyAgent(httpProxy)

  return (input, init) => fetchImpl(input, { ...init, dispatcher })
}

/**
 * @param {object} options
 * @param {string} options.jwksUri Where the platform publishes its public keys.
 * @param {string|null} options.httpProxy The forward proxy URL, or null.
 * @returns {Function} A jose key resolver. Fetches lazily, on first use.
 */
export function createKeySet({ jwksUri, httpProxy }) {
  const proxiedFetch = keySetFetch(httpProxy)

  return createRemoteJWKSet(
    new URL(jwksUri),
    proxiedFetch ? { [customFetch]: proxiedFetch } : {}
  )
}

/**
 * Authenticates callers holding an AWS WebIdentity token, as a Hapi strategy
 * named `jwt`. Registered but never made the default: only the routes that
 * name it are protected.
 *
 * @type {object}
 */
export const jwtAuth = {
  plugin: {
    name: 'jwt-auth',
    register: (server, options) => {
      const {
        mode,
        audience,
        issuer,
        awsAccount,
        allowedCallers,
        jwksUri,
        httpProxy = null,
        // Tests pass a locally generated key set so nothing reaches AWS.
        keySet = null
      } = options

      const subjects = allowedSubjects({ allowedCallers, awsAccount })
      const keys =
        keySet ?? (mode === 'off' ? null : createKeySet({ jwksUri, httpProxy }))

      server.auth.scheme('jwt', () => ({
        authenticate: async (request, h) => {
          if (mode === 'off') {
            return h.authenticated({ credentials: {} })
          }

          const outcome = await validate(keys, request.headers, {
            audience,
            issuer,
            subjects
          })

          if (outcome.ok) {
            request.logger[mode === 'audit' ? 'info' : 'debug'](
              { auth: outcome.caller, mode },
              'caller authenticated'
            )

            return h.authenticated({ credentials: outcome.caller })
          }

          // `error` is the Boom the enforce path throws. Logging it would put
          // a stack and a response envelope in every audit line for no gain —
          // the reason, the subject and the detail are what a person reads.
          const { error, ok, ...diagnosis } = outcome

          request.logger.warn(
            { auth: diagnosis, mode },
            'caller failed authentication'
          )

          if (mode === 'audit') {
            return h.authenticated({ credentials: {} })
          }

          throw error
        }
      }))

      server.auth.strategy('jwt', 'jwt')

      // Which platform settings reached the running service, as presence and
      // never as values. A portal terminal runs in its own container and shows
      // a curated slice of the platform's variables rather than this service's
      // environment, so this line is the only place the answer can be read —
      // in every environment, as the rollout reaches it. `httpProxy` decides
      // whether the key fetch gets a proxied client, and there is no direct
      // route to the key host, so a false there is worth knowing before
      // `enforce` rather than after.
      server.logger.info(
        {
          auth: {
            mode,
            issuer: issuer !== '',
            jwksUri: jwksUri !== '',
            awsAccount: awsAccount !== '',
            httpProxy: Boolean(httpProxy)
          }
        },
        `Service-to-service authentication is ${mode}`
      )
    }
  }
}

async function validate(keys, headers, { audience, issuer, subjects }) {
  const token = bearerToken(headers)

  if (!token) {
    return {
      ok: false,
      reason: 'no_bearer_token',
      error: Boom.unauthorized('Missing bearer token', 'Bearer')
    }
  }

  let payload

  try {
    ;({ payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      audience,
      issuer
    }))
  } catch (error) {
    if (!TOKEN_ERROR_CODES.has(error.code)) {
      return {
        ok: false,
        reason: 'key_set_unavailable',
        detail: error.message,
        error: Boom.serverUnavailable('Cannot verify the token')
      }
    }

    return {
      ok: false,
      reason: error.code,
      detail: error.message,
      error: Boom.unauthorized('Invalid token', 'Bearer')
    }
  }

  const caller = {
    subject: payload.sub ?? null,
    serviceName: callerServiceName(payload)
  }

  if (!isAllowedCaller(subjects, payload.sub)) {
    return {
      ok: false,
      reason: 'caller_not_allowed',
      ...caller,
      error: Boom.forbidden('Caller is not permitted')
    }
  }

  return { ok: true, caller }
}
