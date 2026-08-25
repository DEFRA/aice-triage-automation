import { config } from '#/config.js'
import { health } from '#/routes/health.js'
import { example } from '#/routes/example.js'
import { score } from '#/routes/score.js'
import { submissions } from '#/routes/submissions.js'
import { dev } from '#/routes/dev.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      const routes = [health, score].concat(submissions, example)

      if (config.get('isDevelopment')) {
        routes.push(...dev)
      }

      server.route(routes)
    }
  }
}
