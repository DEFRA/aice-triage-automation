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

// Deliberately hard schema - requires exactly 3 character code on impossible field
const hardSchema = z.object({
  greeting: z.string().min(1),
  language: z.enum(['english', 'welsh', 'french']),
  countryCode: z.string().length(3), // Must be EXACTLY 3 chars
  confident: z.boolean()
})

const model = new BedrockModel({ region, modelId, maxTokens: 256 })

console.log(`Testing hard schema...`)
const startTime = Date.now()
try {
  const agent = new Agent({
    model,
    systemPrompt: 'You greet people. Answer only through the provided schema.',
    structuredOutputSchema: hardSchema
  })

  //4 turns for extra retry headroom a safety margin to reduce false failures during experiments.
  const result = await agent.invoke(
    'Greet me in Welsh with a 3-character country code.',
    {
      limits: { turns: 4 }
    }
  )

  if (!result.structuredOutput) {
    throw new Error(
      `model produced no structured output (stop=${result.stopReason})`
    )
  }

  console.log('✓ Hard schema succeeded:')
  console.log(result.structuredOutput)
  console.log(`\nTurns used: ${result.turnCount || 'unknown'}`)
  console.log(`Stop reason: ${result.stopReason}`)
  console.log(`Time taken: ${Date.now() - startTime}ms`)
} catch (error) {
  console.error(`\n✗ Hard schema FAILED after ${Date.now() - startTime}ms`)
  console.error(`Error: ${error?.name}: ${error?.message}`)
  process.exit(1)
}
