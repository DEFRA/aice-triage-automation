import { describe, test, expect, vi, beforeEach } from 'vitest'
import { scoringResultZod } from '#/domain/scoring-schema.js'
import { SCORING_SYSTEM_PROMPT } from '#/agents/prompt.js'

const mockInvoke = vi.fn()
const agentInstances = []

vi.mock('@strands-agents/sdk', () => ({
  BedrockModel: function BedrockModel() {},
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
  scoreModelId: 'anthropic.claude-3-7-sonnet-20250219-v1:0'
}

beforeEach(() => {
  vi.clearAllMocks()
  agentInstances.length = 0
})

describe('#agents/engine-bedrock', () => {
  test('AC1: createBedrockEngine returns object with name and score', () => {
    const engine = createBedrockEngine(config)

    expect(engine.name).toBe('bedrock')
    expect(typeof engine.score).toBe('function')
  })

  test('AC5: Agent is constructed with structuredOutputSchema', async () => {
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

  test('AC4 + AC5: missing structuredOutput throws named error quoting stopReason', async () => {
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

  test('AC5: a fresh Agent is created per score() call', async () => {
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

  test('redacts explanations in scoring output', () => {
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
})
