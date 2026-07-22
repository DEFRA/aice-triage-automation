import { health } from '#/routes/health.js'
import { example } from '#/routes/example.js'
import { score } from '#/routes/score.js'
import { submissions } from '#/routes/submissions.js'

export const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health, score, submissions].concat(example))
    }
  }
}
