# Coding standards

This service follows the **DEFRA AICE JavaScript style guide**:

<https://github.com/DEFRA/aice-team/blob/main/style-guides/javascript.md>

The AICE guide is the authoritative reference for this repository. It builds on
the base [Defra JavaScript standards](https://github.com/DEFRA) and is enforced
through ESLint (neostandard) and Prettier — run `npm run lint` and
`npm run format:check` (both are part of the pre-commit hook).

## How the guide is enforced

| Concern         | Tooling                                                                                 |
| :-------------- | :-------------------------------------------------------------------------------------- |
| Linting         | ESLint with `neostandard` (`eslint.config.js`)                                          |
| Formatting      | Prettier — 2 spaces, no semicolons, single quotes, no trailing comma (`.prettierrc.js`) |
| Editor defaults | `.editorconfig` (UTF-8, LF, 2-space, final newline)                                     |
| Node.js version | Active LTS (Node 24) pinned in `.nvmrc`                                                 |
| Dependencies    | Exact pins only; `.npmrc` sets `save-exact`, `ignore-scripts`, `min-release-age=7`      |
| Tests           | Vitest, `vi.mock()` for mocking                                                         |

Key code conventions from the guide: ES modules only (no CommonJS), **named
exports only** (no default exports), `const`/`let` (never `var`), function
declarations for named functions and arrow functions for callbacks (parentheses
always required), single quotes, kebab-case filenames, and `tests/` separated
from the code under test.

## Deviations from the CDP Node.js template

This repository was scaffolded from the CDP Node.js backend template (see the
`Applying template` commit). Two of the template's conventions conflict with the
AICE style guide. **Where they conflict, the AICE guide wins**, so the following
were changed away from the CDP defaults:

| Area             | CDP template default                                           | AICE guide / this repo                                                               |
| :--------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| Test location    | Tests colocated next to source (`src/**/*.test.js`)            | Tests in a dedicated root `tests/` directory mirroring `src/` (`tests/**/*.test.js`) |
| Source filenames | PascalCase for some files (e.g. `src/services/ExampleFind.js`) | kebab-case for all filenames (e.g. `src/services/example-find.js`)                   |

Practical consequences:

- New test files go under `tests/`, not next to the module they test. Import the
  module under test via the `#/*` alias (e.g.
  `import { failAction } from '#/common/helpers/fail-action.js'`) rather than a
  relative path.
- `sonar-project.properties` points Sonar at `tests/` (`sonar.tests=tests/`,
  `sonar.test.inclusions=tests/**/*.test.js`).
- All new files — including services and helpers — use kebab-case names.

Everything else follows the CDP template unchanged.
