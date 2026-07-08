import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const EXPECTED_HOOKS_PATH = '.husky/_'
const PRE_COMMIT_FILE = '.husky/pre-commit'
const PRE_COMMIT_COMMAND = 'npm run git:pre-commit-hook'

function getHooksPath() {
  try {
    return execSync('git config --get core.hooksPath', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

const hooksPath = getHooksPath()

if (hooksPath !== EXPECTED_HOOKS_PATH) {
  fail(
    `Git hooksPath is '${hooksPath || '(not set)'}', expected '${EXPECTED_HOOKS_PATH}'. Run 'npm run git:hooks'.`
  )
}

if (!existsSync(PRE_COMMIT_FILE)) {
  fail(`Missing ${PRE_COMMIT_FILE}.`)
}

if (existsSync(PRE_COMMIT_FILE)) {
  const preCommitBody = readFileSync(PRE_COMMIT_FILE, 'utf8')

  if (!preCommitBody.includes(PRE_COMMIT_COMMAND)) {
    fail(`${PRE_COMMIT_FILE} does not run '${PRE_COMMIT_COMMAND}'.`)
  }
}

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('Git hooks are installed and configured correctly')
