import { config } from '#/config.js'
import { createStubEngine } from '#/agents/engine-stub.js'
import { createBedrockEngine } from '#/agents/engine-bedrock.js'

/**
 * @returns {import('./engine.js').Engine}
 */
export function chooseEngine() {
  if (config.get('scoringEngine') === 'bedrock') {
    const bedrock = config.get('bedrock')

    if (!bedrock.scoreModelId) {
      throw new Error('Missing required setting: bedrock.scoreModelId')
    }

    if (!bedrock.classifyModelId) {
      throw new Error('Missing required setting: bedrock.classifyModelId')
    }

    return createBedrockEngine(bedrock)
  }

  return createStubEngine()
}
