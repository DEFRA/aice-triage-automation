import { describe, test, expect, vi, beforeEach } from 'vitest'
import { scoringResultZod } from '#/domain/scoring-schema.js'
import { SCORING_SYSTEM_PROMPT } from '#/agents/prompt.js'

const mockInvoke = vi.fn()
const agentInstances = []
const bedrockModelInstances = []

vi.mock('@strands-agents/sdk', () => ({
  BedrockModel: function BedrockModel(options) {
    this._options = options
    bedrockModelInstances.push(this)
  },
  Agent: function Agent(options) {
    this._options = options
    this.invoke = mockInvoke
    agentInstances.push(this)
  }
}))

const { createBedrockEngine, redactScoringResult } =
  await import('#/agents/engine-bedrock.js')

const config = {
  region: 'eu-west-2',
  scoreModelId: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  classifyModelId: 'anthropic.claude-3-haiku-20240307-v1:0'
}

beforeEach(() => {
  vi.clearAllMocks()
  agentInstances.length = 0
  bedrockModelInstances.length = 0
})

describe('#agents/engine-bedrock', () => {
  test('AC1: createBedrockEngine returns object with name and score', () => {
    const engine = createBedrockEngine(config)
    expect(engine.name).toBe('bedrock')
    expect(typeof engine.score).toBe('function')
  })

  test('Agent is constructed with structuredOutputSchema', async () => {
    mockInvoke.mockResolvedValue({
      structuredOutput: { criteria: {} },
      stopReason: 'end_turn'
    })
    const engine = createBedrockEngine(config)
    await engine.score('some text')

    expect(agentInstances).toHaveLength(1)
    expect(agentInstances[0]._options.structuredOutputSchema).toBe(
      scoringResultZod
    )
    expect(agentInstances[0]._options.systemPrompt).toBe(SCORING_SYSTEM_PROMPT)
  })

  test('Missing structuredOutput throws named error quoting stopReason', async () => {
    mockInvoke.mockResolvedValue({
      structuredOutput: null,
      stopReason: 'max_tokens'
    })
    const engine = createBedrockEngine(config)

    await expect(engine.score('some text')).rejects.toMatchObject({
      name: 'ScoringStructuredOutputError',
      stopReason: 'max_tokens'
    })
  })

  test('A fresh Agent is created per score() call', async () => {
    mockInvoke.mockResolvedValue({
      structuredOutput: { criteria: {} },
      stopReason: 'end_turn'
    })
    const engine = createBedrockEngine(config)
    await engine.score('first call')
    await engine.score('second call')

    expect(agentInstances).toHaveLength(2)
    expect(mockInvoke).toHaveBeenCalledTimes(2)
  })

  test('Redacts explanations in scoring output', () => {
    const input = {
      criteria: {
        business_value: {
          rag: 'amber',
          rubric_band_cited: 'Real problem, AI value not quantified',
          explanation: 'Some detailed model text',
          missing_evidence: true
        }
      },
      routing_recommendation: 'hands_on_session',
      flags: {
        access_request: false,
        governance_required: false,
        low_confidence: false
      }
    }
    const redacted = redactScoringResult(input)

    expect(redacted).toEqual({
      criteria: {
        business_value: {
          rag: 'amber',
          rubric_band_cited: 'Real problem, AI value not quantified',
          explanation: '[REDACTED]',
          missing_evidence: true
        }
      },
      routing_recommendation: 'hands_on_session',
      flags: {
        access_request: false,
        governance_required: false,
        low_confidence: false
      }
    })
  })

  test('Missing structuredOutput from classify throws ClassificationStructuredOutputError', async () => {
    mockInvoke.mockResolvedValue({
      structuredOutput: null,
      stopReason: 'max_tokens'
    })
    const engine = createBedrockEngine(config)

    await expect(engine.classify('some text')).rejects.toMatchObject({
      name: 'ClassificationStructuredOutputError',
      stopReason: 'max_tokens'
    })
  })

  test('Classify uses classifyModel, not scoreModel', async () => {
    mockInvoke.mockResolvedValue({
      structuredOutput: { kind: 'opportunity', reason: 'test' },
      stopReason: 'end_turn'
    })
    const engine = createBedrockEngine({
      region: 'eu-west-2',
      scoreModelId: 'score-model-id',
      classifyModelId: 'classify-model-id'
    })

    await engine.classify('some text')
    const classifyAgentModel = agentInstances[0]._options.model

    mockInvoke.mockResolvedValue({
      structuredOutput: { criteria: {} },
      stopReason: 'end_turn'
    })

    await engine.score('some text')
    const scoreAgentModel = agentInstances[1]._options.model
    expect(classifyAgentModel).not.toBe(scoreAgentModel)
  })

  test('passes guardrailConfig to both BedrockModel clients when configured', () => {
    createBedrockEngine({
      region: 'eu-west-2',
      scoreModelId: 'score-model-id',
      classifyModelId: 'classify-model-id',
      guardrailId: 'gr-123',
      guardrailVersion: '7'
    })
    expect(bedrockModelInstances).toHaveLength(2)
    expect(bedrockModelInstances[0]._options.guardrailConfig).toEqual({
      guardrailIdentifier: 'gr-123',
      guardrailVersion: '7'
    })
    expect(bedrockModelInstances[1]._options.guardrailConfig).toEqual({
      guardrailIdentifier: 'gr-123',
      guardrailVersion: '7'
    })
  })

  test('does not pass guardrailConfig when guardrail is not configured', () => {
    createBedrockEngine({
      region: 'eu-west-2',
      scoreModelId: 'score-model-id',
      classifyModelId: 'classify-model-id',
      guardrailId: '',
      guardrailVersion: ''
    })
    expect(bedrockModelInstances).toHaveLength(2)
    expect(bedrockModelInstances[0]._options.guardrailConfig).toBeUndefined()
    expect(bedrockModelInstances[1]._options.guardrailConfig).toBeUndefined()
  })
})
