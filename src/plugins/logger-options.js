import { ecsFormat } from '@elastic/ecs-pino-format'
import { config } from '#/config.js'
import { getTraceId } from '@defra/hapi-tracing'

const logConfig = config.get('log')
const serviceName = config.get('serviceName')
const serviceVersion = config.get('serviceVersion')

const formatters = {
  ecs: {
    ...ecsFormat({
      serviceVersion,
      serviceName
    })
  },
  'pino-pretty': {}
}

// For pino-pretty we attach the formatter as a synchronous, in-process stream
// (see loggerStream below) rather than as a worker-thread transport. pino's
// transport worker (thread-stream) crashes under `node --watch` on Node 24,
// which breaks `npm run dev`. A direct stream avoids the worker thread entirely.
//
// The import is dynamic because pino-pretty is a devDependency: the production
// image installs with `npm ci --omit=dev`, so the package is not there. A static
// import crashes that image on boot whatever LOG_FORMAT says.
export const loggerStream =
  logConfig.format === 'pino-pretty'
    ? (await import('pino-pretty')).default()
    : undefined

export const loggerOptions = {
  enabled: logConfig.isEnabled,
  ignorePaths: ['/health'],
  redact: {
    paths: logConfig.redact,
    remove: true
  },
  level: logConfig.level,
  ...formatters[logConfig.format],
  nesting: true,
  mixin() {
    const mixinValues = {}
    const traceId = getTraceId()
    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}
