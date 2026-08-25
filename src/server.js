import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { config } from '#/config.js'
import { router } from '#/plugins/router.js'
import { requestLogger } from '#/plugins/request-logger.js'
import { mongoDb } from '#/plugins/mongodb.js'
import { failAction } from '#/common/helpers/fail-action.js'
import { pulse } from '#/plugins/pulse.js'
import { requestTracing } from '#/plugins/request-tracing.js'
import { jwtAuth } from '#/plugins/jwt-auth.js'
import { metrics } from '@defra/cdp-metrics'

/**
 * @param {object} [options] Test seams, not used in production.
 * @param {object} [options.auth] Overrides for the `jwtAuth` plugin, so a test
 *   can pass a locally generated key set instead of reaching the platform's.
 * @returns {Promise<object>} The configured, unstarted Hapi server.
 */
export async function createServer(options = {}) {
  const server = Hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  // Hapi Plugins:
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // secureContext  - loads CA certificates from environment config
  // pulse          - provides shutdown handlers
  // mongoDb        - sets up mongo connection pool and attaches to `server` and `request` objects
  // jwtAuth        - the `jwt` auth strategy, for the routes that ask for it
  // router         - routes used in the app
  //
  // jwtAuth must come before router: Hapi wants a strategy to exist before a
  // route naming it is added, and throws at start-up otherwise.
  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse,
    {
      plugin: mongoDb,
      options: config.get('mongo')
    },
    {
      plugin: jwtAuth,
      options: {
        ...config.get('auth'),
        httpProxy: config.get('httpProxy'),
        ...options.auth
      }
    },
    router
  ])

  return server
}
