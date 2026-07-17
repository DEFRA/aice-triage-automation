// Required env vars for SCORING_ENGINE=bedrock:
//   BEDROCK_SCORE_MODEL_ID     — Bedrock model ID for scoring
//   BEDROCK_CLASSIFY_MODEL_ID  — Bedrock model ID for classification
//   AWS_BEARER_TOKEN_BEDROCK   — API key (read natively by the AWS SDK)

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { config } from '#/config.js'
import { chooseEngine } from '#/agents/choose-engine.js'
import { loadSubmissions } from '#/domain/submission.js'
import { scoreSubmission } from '#/services/score-submission.js'

if (process.env.SCORING_ENGINE === 'bedrock') {
  if (!process.env.BEDROCK_SCORE_MODEL_ID) {
    console.error('BEDROCK_SCORE_MODEL_ID is not set. Add it to .env')
    process.exit(2)
  }
  if (!process.env.BEDROCK_CLASSIFY_MODEL_ID) {
    console.error('BEDROCK_CLASSIFY_MODEL_ID is not set. Add it to .env')
    process.exit(2)
  }
  if (!process.env.AWS_BEARER_TOKEN_BEDROCK) {
    console.error('AWS_BEARER_TOKEN_BEDROCK is not set. Add it to .env')
    process.exit(2)
  }
}

const engine = chooseEngine()
const dir = config.get('submissionsDir')
const submissions = await loadSubmissions(dir)

await mkdir('out', { recursive: true })

const COL = { id: 14, kind: 16, routing: 22 }

console.log(`\nengine: ${engine.name}   submissions: ${submissions.length}\n`)
console.log(
  'id'.padEnd(COL.id) +
    'kind'.padEnd(COL.kind) +
    'routing'.padEnd(COL.routing) +
    'rag'
)
console.log('-'.repeat(68))

let succeeded = 0

for (const sub of submissions) {
  try {
    const result = await scoreSubmission(engine, sub)

    let rag = '-'
    if (result.scoring) {
      const counts = { red: 0, amber: 0, green: 0 }
      for (const criterion of Object.values(result.scoring.criteria)) {
        counts[criterion.rag]++
      }
      rag = `R${counts.red} A${counts.amber} G${counts.green}`
    }

    console.log(
      result.id.padEnd(COL.id) +
        result.kind.padEnd(COL.kind) +
        (result.scoring?.routing_recommendation ?? '-').padEnd(COL.routing) +
        rag
    )

    await writeFile(
      join('out', `${result.id}.json`),
      JSON.stringify(result, null, 2)
    )

    succeeded++
  } catch (err) {
    console.log(sub.id.padEnd(COL.id) + 'ERROR'.padEnd(COL.kind) + err.message)
  }
}

console.log(`\n${succeeded}/${submissions.length} succeeded`)
