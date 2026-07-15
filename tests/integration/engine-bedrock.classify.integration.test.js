import { readFile, appendFile, mkdir } from 'node:fs/promises'
import { describe, test, expect } from 'vitest'

import { createBedrockEngine } from '#/agents/engine-bedrock.js'
import { classificationZod } from '#/domain/scoring-schema.js'

const enabled = process.env.RUN_BEDROCK_INTEGRATION === 'true'
const region = process.env.BEDROCK_REGION
const classifyModelId = process.env.BEDROCK_CLASSIFY_MODEL_ID

async function readFixture(name) {
  const path = new URL(`../fixtures/submissions/${name}`, import.meta.url)
  return readFile(path, 'utf8')
}

async function writeLog(lines) {
  const now = new Date()
  const stamp = now
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19)
  const dir = new URL('../../acceptance-logs/', import.meta.url)
  await mkdir(new URL('.', dir), { recursive: true })
  const file = new URL(`acceptance-test-run-${stamp}.log`, dir)
  await appendFile(file, lines.join('\n') + '\n')
}

describe.skipIf(!enabled)('Bedrock classify integration', () => {
  const cases = [
    { fixture: 'access-request.txt', expectedKind: 'access_request' },
    { fixture: 'opportunity.txt', expectedKind: 'opportunity' }
  ]

  for (const { fixture, expectedKind } of cases) {
    test(`classifies ${fixture} as ${expectedKind}`, async () => {
      const engine = createBedrockEngine({
        region,
        scoreModelId: '',
        classifyModelId
      })

      const text = await readFixture(fixture)
      const result = await engine.classify(text)

      const logLines = [
        `fixture: ${fixture}`,
        `expected: ${expectedKind}`,
        `got:      ${result.kind}`,
        `reason:   ${result.reason}`,
        `schema:   ${classificationZod.safeParse(result).success ? 'PASS' : 'FAIL'}`,
        `result:   ${result.kind === expectedKind ? 'PASS' : 'FAIL'}`,
        '---'
      ]

      await writeLog(logLines)

      expect(classificationZod.safeParse(result).success).toBe(true)
      expect(result.kind).toBe(expectedKind)
    })
  }
})
