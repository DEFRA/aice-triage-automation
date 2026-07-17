import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'

/**
 * @typedef {object} Submission
 * @property {string} id
 * @property {string} text
 */

/**
 * Strip the standard intake-form boilerplate footer.
 * @param {string} raw
 * @returns {string}
 */
export function stripBoilerplate(raw) {
  return raw.replace(/\n+Reply within \d+ working days[\s\S]*/i, '').trim()
}

/**
 * Load every `.md` file in `dir` as a { id, text } submission.
 * @param {string} dir
 * @returns {Promise<Submission[]>}
 */
export async function loadSubmissions(dir) {
  const entries = await readdir(dir)
  const mdFiles = entries.filter((name) => name.endsWith('.md')).sort()

  return Promise.all(
    mdFiles.map(async (name) => {
      const raw = await readFile(join(dir, name), 'utf8')
      return {
        id: basename(name, '.md'),
        text: stripBoilerplate(raw)
      }
    })
  )
}
