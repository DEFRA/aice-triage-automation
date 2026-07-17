import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { config } from '#/config.js'
import { chooseEngine } from '#/agents/choose-engine.js'
import { loadSubmissions } from '#/domain/submission.js'
import { scoreSubmission } from '#/services/score-submission.js'

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
