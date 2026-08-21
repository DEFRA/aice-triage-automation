import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// The production image installs with `npm ci --omit=dev`, so a devDependency is
// simply not there at runtime. A *static* import of one crashes the container on
// boot with ERR_MODULE_NOT_FOUND, before any config is read — no environment
// variable can rescue it. This happened with pino-pretty: the module guarded the
// *use* behind a config check but imported it unconditionally at the top.
//
// Guard the whole class rather than that one package. A devDependency may still
// be loaded lazily, via `await import(...)` on a branch that only development
// takes; this test only rejects the static form.

const { dependencies, devDependencies } = JSON.parse(
  readFileSync('package.json', 'utf8')
)

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.js') ? [path] : []
  })
}

// `import ... from 'x'`, `import 'x'` and `export ... from 'x'`, but not
// `await import('x')` — the dynamic form is the sanctioned escape hatch.
const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\s[^\n]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g

function staticImports(source) {
  return [...source.matchAll(STATIC_IMPORT)].map(
    (match) => match[1] ?? match[2]
  )
}

// 'pino' -> 'pino', '@scope/pkg/sub' -> '@scope/pkg'. Relative and '#/' subpath
// imports are internal and resolve within the image regardless.
function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('#')) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

describe('#production dependencies', () => {
  const offenders = sourceFiles('src').flatMap((file) =>
    staticImports(readFileSync(file, 'utf8'))
      .map(packageName)
      .filter((name) => name && name in devDependencies)
      .map((name) => `${file} statically imports devDependency '${name}'`)
  )

  test('src never statically imports a devDependency', () => {
    expect(offenders).toEqual([])
  })

  test('the guard sees the real dependency list', () => {
    // A typo in package.json parsing would make the test above vacuously pass.
    expect(Object.keys(devDependencies).length).toBeGreaterThan(0)
    expect(dependencies).toHaveProperty('pino')
    expect(devDependencies).toHaveProperty('pino-pretty')
  })
})
