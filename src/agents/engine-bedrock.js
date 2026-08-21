import { Agent, BedrockModel } from '@strands-agents/sdk'

import { classificationZod, scoringResultZod } from '#/domain/scoring-schema.js'
import {
  CLASSIFIER_SYSTEM_PROMPT,
  SCORING_SYSTEM_PROMPT
} from '#/agents/prompt.js'

export class ScoringStructuredOutputError extends Error {
  constructor(stopReason) {
    super(`scorer produced no structured output (stop=${stopReason})`)
    this.name = 'ScoringStructuredOutputError'
    this.stopReason = stopReason
  }
}
export class ClassificationStructuredOutputError extends Error {
  constructor(stopReason) {
    super(`classifier produced no structured output (stop=${stopReason})`)
    this.name = 'ClassificationStructuredOutputError'
    this.stopReason = stopReason
  }
}
export function redactScoringResult(result) {
  return {
    ...result,
    criteria: Object.fromEntries(
      Object.entries(result.criteria).map(([key, value]) => [
        key,
        {
          ...value,
          evidence_quoted: '[REDACTED]',
          explanation: '[REDACTED]'
        }
      ])
    )
  }
}
function toGuardrailConfig({ guardrailId, guardrailVersion }) {
  if (guardrailId === '') {
    return undefined
  }
  return { guardrailIdentifier: guardrailId, guardrailVersion }
}
/**
 * Real engine: a Strands agent over Amazon Bedrock.
 *
 * Credentials are deliberately absent from this signature. The AWS SDK resolves
 * them from the environment, and where they come from differs by environment:
 * on a laptop it is the AWS_BEARER_TOKEN_BEDROCK bearer token, which the SDK
 * reads natively; on CDP it is the container's task role, and no bearer token
 * exists anywhere — there is no platform secret to go looking for. Either way,
 * do NOT also pass an apiKey option: that sets a second Authorization header
 * and Bedrock rejects the request.
 *
 * Both models are constructed with `stream: false`. The SDK streams by default
 * — it takes the ConverseStream API unless the option is explicitly false — and
 * ConverseStream requires `bedrock:InvokeModelWithResponseStream`, which the CDP
 * task role is not granted. The first deployed scoring call failed on exactly
 * that, while `bedrock:InvokeModel` was allowed all along. Nothing here streams
 * to a user: both calls build a structured object and return it whole, so the
 * streaming API buys nothing and costs a permission we do not have.
 *
 * Local runs never caught it. On a laptop the SDK authenticates with
 * AWS_BEARER_TOKEN_BEDROCK, whose permissions are the API key's rather than the
 * task role's.
 *
 * @param {{
 *   region: string,
 *   scoreModelId: string,
 *   classifyModelId: string,
 *   guardrailId: string,
 *   guardrailVersion: string
 * }} bedrockConfig
 * @returns {import('./engine.js').Engine}
 */
export function createBedrockEngine(bedrockConfig) {
  const { region, scoreModelId, classifyModelId } = bedrockConfig

  const scoreModel = new BedrockModel({
    region,
    modelId: scoreModelId,
    maxTokens: 4096,
    stream: false,
    guardrailConfig: toGuardrailConfig(bedrockConfig)
  })

  const classifyModel = new BedrockModel({
    region,
    modelId: classifyModelId,
    maxTokens: 512,
    stream: false,
    guardrailConfig: toGuardrailConfig(bedrockConfig)
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
        throw new ScoringStructuredOutputError(result.stopReason)
      }
      return result.structuredOutput
    },

    async classify(text) {
      const agent = new Agent({
        model: classifyModel,
        systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
        structuredOutputSchema: classificationZod
      })

      const result = await agent.invoke(text, { limits: { turns: 3 } })

      if (!result.structuredOutput) {
        throw new ClassificationStructuredOutputError(result.stopReason)
      }

      return result.structuredOutput
    }
  }
}
