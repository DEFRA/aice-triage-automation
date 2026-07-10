import { Agent, BedrockModel } from '@strands-agents/sdk'
import { z } from 'zod'

import { config } from '#/config.js'

const region = config.get('bedrock.region')
const modelId = config.get('bedrock.scoreModelId')

if (!modelId) {
  console.error(
    'bedrock.scoreModelId is not set. Add BEDROCK_SCORE_MODEL_ID to .env'
  )
  process.exit(2)
}
if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
  console.error(
    'AWS_BEARER_TOKEN_BEDROCK is not set. Add the Bedrock API key to .env'
  )
  process.exit(2)
}

const greetingSchema = z.object({
  greeting: z.string().min(1),
  language: z.enum(['english', 'welsh', 'french']),
  confident: z.boolean()
})

const model = new BedrockModel({ region, modelId, maxTokens: 256 })

console.log(
  `Calling Bedrock with structured output — model=${modelId}, region=${region} ...`
)
try {
  const agent = new Agent({
    model,
    systemPrompt: 'You greet people. Answer only through the provided schema.',
    structuredOutputSchema: greetingSchema
  })

  const result = await agent.invoke('Greet me in Welsh.', {
    limits: { turns: 3 }
  })

  if (!result.structuredOutput) {
    throw new Error(
      `model produced no structured output (stop=${result.stopReason})`
    )
  }

  console.log('✓ Structured output received:')
  console.log(result.structuredOutput)
  console.log(`\nLanguage value: ${result.structuredOutput.language}`)
  console.log(`Turns used: ${result.turnCount || 'unknown'}`)
  console.log(`Stop reason: ${result.stopReason}`)
} catch (error) {
  console.error(`Bedrock call FAILED: ${error?.name}: ${error?.message}`)
  process.exit(1)
}
