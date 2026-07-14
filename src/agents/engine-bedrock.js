import { Agent, BedrockModel } from '@strands-agents/sdk'

import { scoringResultZod } from '#/domain/scoring-schema.js'
import { SCORING_SYSTEM_PROMPT } from '#/agents/prompt.js'

/**
 * Real engine: a Strands agent over Amazon Bedrock.
 *
 * Authentication flows via the AWS_BEARER_TOKEN_BEDROCK environment variable,
 * which the AWS SDK reads natively. Do NOT also pass an apiKey option — that
 * sets a second Authorization header and Bedrock rejects the request.
 *
 * @param {{ region: string, scoreModelId: string }} bedrockConfig
 * @returns {import('./engine.js').Engine}
 */
export function createBedrockEngine(bedrockConfig) {
  const { region, scoreModelId } = bedrockConfig

  const scoreModel = new BedrockModel({
    region,
    modelId: scoreModelId,
    maxTokens: 4096
  })

  return {
    name: 'bedrock',

    async score(text) {
      const agent = new Agent({
        model: scoreModel,
        systemPrompt: SCORING_SYSTEM_PROMPT,
        structuredOutputSchema: scoringResultZod
      })

      const result = await agent.invoke(text, { limits: { turns: 4 } })

      if (!result.structuredOutput) {
        throw new Error(
          `scorer produced no structured output (stop=${result.stopReason})`
        )
      }

      return result.structuredOutput
    }
  }
}
