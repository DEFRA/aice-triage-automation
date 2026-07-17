import Joi from 'joi'

import { chooseEngine } from '#/agents/choose-engine.js'
import { scoreSubmission } from '#/services/score-submission.js'
import { stripBoilerplate } from '#/domain/submission.js'

export const score = {
  method: 'POST',
  path: '/score',
  options: {
    validate: {
      payload: Joi.object({
        id: Joi.string().min(1).required(),
        text: Joi.string().min(1).required()
      })
    }
  },
  handler: async (request, h) => {
    const { id, text } = request.payload

    const result = await scoreSubmission(chooseEngine(), {
      id,
      text: stripBoilerplate(text)
    })

    return h.response(result)
  }
}
