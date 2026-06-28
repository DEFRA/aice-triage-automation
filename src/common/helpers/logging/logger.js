import { pino } from 'pino'

import { loggerOptions, loggerStream } from '#/plugins/logger-options.js'

const logger = loggerStream
  ? pino(loggerOptions, loggerStream)
  : pino(loggerOptions)

export function createLogger() {
  return logger
}
