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

// Matches `import ... from 'x'`, `export ... from 'x'` and bare `import 'x'`,
// across as many lines as the clause spans — Prettier wraps any import past 80
// characters, so a single-line-only pattern would miss most real ones.
//
// The middle is `[^'"()]*?` rather than `[\s\S]*?`: excluding quotes stops the
// match running past one statement's specifier into the next statement's, and
// excluding parentheses keeps `await import('x')` out. Requiring whitespace
// after the keyword excludes the dynamic form too, since that reads `import(`.
const STATIC_IMPORT =
  /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"()]*?\bfrom\s*)?['"]([^'"]+)['"]/g

export function staticImports(source) {
  return [...source.matchAll(STATIC_IMPORT)].map((match) => match[1])
}

// 'pino' -> 'pino', '@scope/pkg/sub' -> '@scope/pkg'. Relative and '#/' subpath
// imports are internal and resolve within the image regardless.
export function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('#')) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

describe('#staticImports', () => {
  test('finds a single-line default import', () => {
    expect(staticImports("import pinoPretty from 'pino-pretty'")).toEqual([
      'pino-pretty'
    ])
  })

  // The case that slipped through the first version of this test.
  test('finds an import whose named specifiers wrap over several lines', () => {
    const source = `import {
  prettyFactory,
  colorizerFactory
} from 'pino-pretty'
`
    expect(staticImports(source)).toEqual(['pino-pretty'])
  })

  test('finds a multi-line import even with a trailing comma and comments', () => {
    const source = `import {
  a, // the first thing
  b,
} from 'vitest'
`
    expect(staticImports(source)).toEqual(['vitest'])
  })

  test('finds a bare side-effect import', () => {
    expect(staticImports("import 'dotenv/config'")).toEqual(['dotenv/config'])
  })

  test('finds re-exports', () => {
    expect(staticImports("export { x } from 'pino'")).toEqual(['pino'])
    expect(staticImports("export * from './local.js'")).toEqual(['./local.js'])
  })

  test('keeps consecutive statements separate rather than spanning them', () => {
    const source = `import 'side-effect'
import { a } from 'first'
import {
  b
} from 'second'
`
    expect(staticImports(source)).toEqual(['side-effect', 'first', 'second'])
  })

  // The sanctioned escape hatch: this is what logger-options.js does, and the
  // guard must not flag it or the fix it verifies would fail its own test.
  test('ignores dynamic imports, single-line and wrapped', () => {
    expect(staticImports("const p = (await import('pino-pretty')).default()")) //
      .toEqual([])
    expect(
      staticImports(`const p = (
  await import('pino-pretty')
).default()`)
    ).toEqual([])
  })

  test('ignores the word import inside a string or comment', () => {
    expect(staticImports("// we import 'pino-pretty' lazily below")).toEqual([])
  })
})

describe('#packageName', () => {
  test('reduces a specifier to its package', () => {
    expect(packageName('pino')).toBe('pino')
    expect(packageName('dotenv/config')).toBe('dotenv')
    expect(packageName('@elastic/ecs-pino-format')).toBe(
      '@elastic/ecs-pino-format'
    )
    expect(packageName('@scope/pkg/sub/path')).toBe('@scope/pkg')
  })

  test('treats relative and subpath imports as internal', () => {
    expect(packageName('./logger.js')).toBeNull()
    expect(packageName('../config.js')).toBeNull()
    expect(packageName('#/config.js')).toBeNull()
  })
})

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

  test('the scan actually reached the source tree', () => {
    // Likewise: an empty file list would pass silently.
    expect(sourceFiles('src').length).toBeGreaterThan(10)
  })
})
