import Joi from 'joi'

import {
  insertSubmission,
  findSubmission,
  generateSubmissionId
} from '#/services/submissions.js'

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
      const submissionId = await generateSubmissionId(request.db)

      await insertSubmission(request.db, { submissionId, text, submittedAt })

      const entity = await findSubmission(request.db, submissionId)

      return h.response(entity).code(201)
    }
  }
]
