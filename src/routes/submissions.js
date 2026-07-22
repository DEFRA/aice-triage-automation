import Boom from '@hapi/boom'
import Joi from 'joi'

import {
  insertSubmission,
  findSubmissions,
  findSubmission,
  SUBMISSION_STATUSES
} from '#/services/submissions.js'

export const submissions = [
  {
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
  },
  {
    method: 'GET',
    path: '/submissions',
    options: {
      validate: {
        query: Joi.object({
          status: Joi.string()
            .valid(...SUBMISSION_STATUSES)
            .required()
        })
      }
    },
    handler: async (request, h) => {
      const entities = await findSubmissions(request.db, {
        status: request.query.status
      })

      return h.response(entities)
    }
  },
  {
    method: 'GET',
    path: '/submissions/{submissionId}',
    options: {
      validate: {
        params: Joi.object({
          submissionId: Joi.string().min(1).required()
        })
      }
    },
    handler: async (request, h) => {
      const entity = await findSubmission(
        request.db,
        request.params.submissionId
      )

      if (!entity) {
        return Boom.notFound()
      }

      return h.response(entity)
    }
  }
]
