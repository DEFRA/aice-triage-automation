import hapiPino from 'hapi-pino'

import { loggerOptions, loggerStream } from './logger-options.js'

export const requestLogger = {
  plugin: hapiPino,
  options: {
    ...loggerOptions,
    ...(loggerStream ? { stream: loggerStream } : {})
  }
}
