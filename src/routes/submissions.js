import Joi from 'joi'

import { insertSubmission } from '#/services/submissions.js'

export const submissions = {
  method: 'POST',
  path: '/submissions',
  options: {
    validate: {
      payload: Joi.object({
        submissionId: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        submittedAt: Joi.string().isoDate().optional()
      })
    }
  },
  handler: async (request, h) => {
    const { submissionId, text, submittedAt } = request.payload
    await insertSubmission(request.db, {
      submissionId,
      text,
      submittedAt
    })

    return h.response().code(202)
  }
}
