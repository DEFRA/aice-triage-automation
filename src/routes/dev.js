import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  insertSubmission,
  findSubmission,
  generateSubmissionId
} from '#/services/submissions.js'

const MAX_SEED_ATTEMPTS = 5

// Dev-only convenience route: lets a developer create an unprocessed
// submission without going through the real intake flow, so the frontend
// queue and scoring endpoints have something to work against locally.
// Only registered when config.isDevelopment is true — see src/plugins/router.js.
export const dev = [
  {
    method: 'POST',
    path: '/_dev/seed-submission',
    options: {
      validate: {
        payload: Joi.object({
          text: Joi.string().min(1).required(),
          submittedAt: Joi.string().isoDate().optional()
        })
      }
    },
    handler: async (request, h) => {
      const { text, submittedAt } = request.payload

      // insertSubmission upserts on submissionId, so a collision with an
      // existing id is a silent no-op (matchedCount: 1, upsertedCount: 0)
      // rather than a duplicate-key error. Only upsertedId tells us the
      // insert actually happened, so retry with a fresh id on collision
      // instead of trusting generateSubmissionId to always be unique.
      for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt++) {
        const submissionId = await generateSubmissionId(request.db)
        const result = await insertSubmission(request.db, {
          submissionId,
          text,
          submittedAt
        })

        if (result.upsertedId) {
          const entity = await findSubmission(request.db, submissionId)
          return h.response(entity).code(201)
        }
      }

      return Boom.conflict(
        'Could not generate a unique submissionId, please retry'
      )
    }
  }
]
