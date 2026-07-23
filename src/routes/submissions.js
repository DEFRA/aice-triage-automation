import Boom from '@hapi/boom'
import Joi from 'joi'

import { chooseEngine } from '#/agents/choose-engine.js'
import { stripBoilerplate } from '#/domain/submission.js'
import { scoreSubmission } from '#/services/score-submission.js'
import {
  insertSubmission,
  findSubmissions,
  findSubmission,
  markScored,
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
  },
  {
    method: 'POST',
    path: '/submissions/{submissionId}/score',
    options: {
      validate: {
        params: Joi.object({
          submissionId: Joi.string().min(1).required()
        })
      }
    },
    handler: async (request, h) => {
      const { submissionId } = request.params
      const entity = await findSubmission(request.db, submissionId)

      if (!entity) {
        return Boom.notFound()
      }

      if (entity.status === 'scored') {
        return h.response(entity.result).code(200)
      }

      const lock = await request.locker.lock(submissionId)

      if (!lock) {
        return Boom.conflict()
      }

      try {
        const strippedText = stripBoilerplate(entity.text)

        const result = await scoreSubmission(chooseEngine(), {
          id: submissionId,
          text: strippedText
        })

        await markScored(request.db, submissionId, result)

        return h.response(result).code(200)
      } finally {
        await lock.free()
      }
    }
  }
]
