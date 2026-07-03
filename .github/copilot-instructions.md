# Copilot instructions — aice-triage-automation

> These instructions are loaded automatically by GitHub Copilot (CLI and IDE).
> They are a **router**, not a rulebook: the authoritative detail lives in the
> `docs/` files linked below. Keep this file short and point at those.

## What this service is

A plain-JavaScript **Hapi.js backend** on Node.js that automates the AICE team's
AI use-case **triage** (Intake → Transcript → Draft ticket → Scoring → Decision).
A human reviews and approves at every stage; the AI reasoning is delegated to
**Amazon Bedrock**. Only **OFFICIAL** information is handled. It runs on Defra's
Core Delivery Platform (CDP) and is scaffolded from the CDP Node.js template.

Read these first — do not restate their contents, rely on them:

- Architecture and components — [`docs/architecture.md`](../docs/architecture.md)
- Coding standards (authoritative) — [`docs/coding-standards.md`](../docs/coding-standards.md)
- Getting it running — [`docs/first-time-dev-setup.md`](../docs/first-time-dev-setup.md)
- How we use Copilot here — [`docs/using-copilot.md`](../docs/using-copilot.md)

## Conventions that must not be broken

These come from the [DEFRA AICE JavaScript style guide](https://github.com/DEFRA/aice-team/blob/main/style-guides/javascript.md).
When generating or editing code, follow them:

- **ES modules only** — no CommonJS (`require`/`module.exports`).
- **Named exports only** — never `export default`.
- **`const`/`let`, never `var`.** Function declarations for named functions;
  arrow functions (parentheses always) for callbacks.
- **Single quotes, 2-space indent, no semicolons, no trailing commas** (Prettier).
- **kebab-case filenames** for everything, including services and helpers
  (e.g. `example-find.js`, not `ExampleFind.js`).
- **Tests live in the root `tests/` directory**, mirroring `src/` — _not_
  colocated. Import the module under test via the `#/*` alias
  (e.g. `import { failAction } from '#/common/helpers/fail-action.js'`).
- **Vitest** with `vi.mock()` for mocking.
- **Dependencies are exact-pinned** (`.npmrc` sets `save-exact`); do not add
  caret/tilde ranges.

## Layering

- Routes in `src/routes/` stay thin (HTTP concerns only).
- Business logic in `src/services/` (kebab-case, named exports).
- Validate input with **Joi** (`failAction` is global).
- Reach MongoDB via `request.db`; take write locks via `request.locker`.
- Configuration via **convict** in `src/config.js` — every setting has a default
  and an env override; validate at startup.

## Security and data handling

- **Never** hard-code secrets; use env/convict config.
- **Never** log PII or transcript content. Only OFFICIAL data is in scope.
- All outbound HTTP in the cloud goes through the CDP forward proxy — use
  `undici` (`fetch` / `ProxyAgent`), see the README "Proxy" section.

## Before you commit

Run the same checks the pre-commit hook runs:

```bash
npm run format:check   # Prettier
npm run lint           # ESLint (neostandard)
npm test               # Vitest + coverage
```

Or all together: `npm run git:pre-commit-hook`. Fix failures before committing.

## Routines

Named, repeatable workflows live in `docs/routines/`. When asked to run one
(e.g. _"run the workspace-reset routine"_), read the corresponding file and
execute every step it describes in order. Do not skip steps.

| Routine         | File                               | When to use                                       |
| :-------------- | :--------------------------------- | :------------------------------------------------ |
| workspace-reset | `docs/routines/workspace-reset.md` | Clear and rebuild the local environment from zero |

## Git workflow

- **Never commit directly to `main`.** Work on a feature branch named for the
  ticket (e.g. `CAIT-172-initial-service-setup`), open a PR, get review, merge.
- Commit messages follow **Conventional Commits**
  (`type(scope): subject`, imperative, ≤ 72 chars, no trailing period).
