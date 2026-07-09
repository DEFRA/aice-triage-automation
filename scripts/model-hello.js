import { Agent, BedrockModel } from '@strands-agents/sdk'

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

// Authentication flows via the AWS_BEARER_TOKEN_BEDROCK environment variable,
// which the AWS SDK underneath Strands reads by itself. Do NOT also pass an
// `apiKey` option here — that sends two Authorization headers and Bedrock
// rejects the request.
const model = new BedrockModel({ region, modelId, maxTokens: 64 })
const agent = new Agent({ model })

console.log(`Calling Bedrock — model=${modelId}, region=${region} ...`)
try {
  const result = await agent.invoke('Reply with exactly: OK')
  const text = (result.lastMessage?.content ?? [])
    .map((block) => (typeof block?.text === 'string' ? block.text : ''))
    .join('')
    .trim()
  console.log(`stopReason: ${result.stopReason}`)
  console.log(`response:   ${text}`)
} catch (error) {
  console.error(`Bedrock call FAILED: ${error?.name}: ${error?.message}`)
  console.error(
    'Likely causes: model not enabled for this account, wrong region, ' +
      'bad or expired API key, or an organisation-level policy blocking the model.'
  )
  process.exit(1)
}
