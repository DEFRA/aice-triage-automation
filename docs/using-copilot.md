# How we use Copilot here

**Audience:** anyone contributing to `aice-triage-automation`, especially if
you're new to working alongside an AI assistant on a real Defra service.

This repo is deliberately **instructional**. It demonstrates a normal software
development lifecycle (SDLC) and shows where AI assistants like GitHub Copilot
fit into it — and, just as importantly, where they _don't_. Read this once
before you start; it explains what's set up, why, and how to get value from it
safely.

- [The short version](#the-short-version)
- [What's configured in this repo](#whats-configured-in-this-repo)
- [Where AI fits in our SDLC](#where-ai-fits-in-our-sdlc)
- [A worked loop: adding a small feature](#a-worked-loop-adding-a-small-feature)
- [Prompts that work well here](#prompts-that-work-well-here)
- [Routines](#routines)
- [Project skills](#project-skills)
- [Guardrails — the non-negotiables](#guardrails--the-non-negotiables)
- [You are accountable, not the model](#you-are-accountable-not-the-model)
- [Where to go next](#where-to-go-next)

## The short version

- Copilot has been given repo-specific context so its suggestions match **our**
  conventions, not generic defaults.
- Treat it as a **fast, tireless pair — not an authority**. It drafts; you
  review, test, and decide.
- Every AI-assisted change goes through the **same gates as any other change**:
  lint, format, tests, human review on a pull request.
- **Never** paste secrets, real submissions, transcripts, or other non-OFFICIAL
  data into a prompt.

## What's configured in this repo

| File / setting                                                          | What it does                                                                                                                                                 |
| :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | Loaded automatically by Copilot (CLI **and** IDE). Tells it our conventions, layering, security rules, and pre-commit checks — and points it at our `docs/`. |
| [`docs/coding-standards.md`](./coding-standards.md)                     | The authoritative style guide for this repo (AICE JavaScript guide + how it's enforced).                                                                     |
| [`docs/architecture.md`](./architecture.md)                             | How the service is put together, local vs. cloud.                                                                                                            |
| [`docs/first-time-dev-setup.md`](./first-time-dev-setup.md)             | Fresh clone → running, hot-reloading server with passing tests.                                                                                              |

Because the instructions file is auto-loaded, **you don't have to do anything**
to benefit — asking Copilot "add a route that…" will produce code that already
uses ES modules, named exports, kebab-case filenames, and tests in `tests/`.

> **Why a router, not a rulebook?** `copilot-instructions.md` deliberately points
> at the `docs/` rather than duplicating them. One source of truth means the docs
> and the AI never drift apart — when you update a doc, Copilot's guidance updates
> with it.

## Where AI fits in our SDLC

The lifecycle doesn't change because we're using AI. The tools just help at each
stage. What _never_ changes is that a person owns each step.

| SDLC stage            | Without AI              | With Copilot                                                           | Who's accountable |
| :-------------------- | :---------------------- | :--------------------------------------------------------------------- | :---------------- |
| Understand the ticket | Read docs, ask the team | Ask Copilot to summarise/orient, e.g. "explain how routing works here" | You               |
| Design                | Sketch the approach     | Talk options through; ask for trade-offs                               | You               |
| Write code            | Type it                 | Draft handlers/services/tests, then review line by line                | You               |
| Test                  | Write tests             | Draft Vitest cases; **you** confirm they test the right thing          | You               |
| Review                | Open a PR               | Copilot can pre-review, but a **human approves**                       | The reviewer      |
| Ship                  | Merge after CI          | Same CI gates apply                                                    | The team          |

The rule of thumb: **AI accelerates the typing and the recall; it does not take
the decisions or the accountability.**

## A worked loop: adding a small feature

This mirrors how you'd actually do it, with the human checkpoints called out.

1. **Branch.** Never work on `main`. Name the branch for the ticket:
   `git checkout -b CAIT-123-add-scoring-endpoint`.
2. **Orient.** Ask Copilot to explain the relevant area first, e.g.
   _"How are routes registered, and where does business logic live?"_ Verify its
   answer against [`docs/architecture.md`](./architecture.md) — don't take it on
   faith.
3. **Draft.** Ask for the change in small pieces: a route in `src/routes/`, the
   logic in a `src/services/` module, Joi validation, and a test in `tests/`.
4. **Review every line.** Does it use named exports? kebab-case filename? Is the
   test in `tests/` using the `#/*` import alias? If not, ask it to fix — or fix
   it yourself.
5. **Run the gates locally** (the same ones the pre-commit hook runs):

   ```bash
   npm run format:check
   npm run lint
   npm test
   ```

   Or all at once: `npm run git:pre-commit-hook`.

6. **Commit** with a Conventional Commit message, e.g.
   `feat(scoring): add endpoint to score a submission`.
7. **Open a PR** and get a human review. AI review is a helpful extra, **not** a
   substitute for it.

## Prompts that work well here

Good prompts give Copilot the context and the constraints. Some patterns that
pay off in this repo:

- _"Add a `GET /submissions/{id}` route following the existing `example.js`
  pattern — thin handler, logic in a new `src/services/…` module, Joi-validate
  the id, and a Vitest test in `tests/`."_
- _"Review this diff against `docs/coding-standards.md` and flag anything that
  doesn't match."_
- _"Explain what this plugin does and why it's registered in this order."_
- _"Write the test first: cover the happy path, a validation error, and a
  service failure."_ (Test-first is a great way to keep the AI honest.)

Weaker prompts are vague ("make this better") or ask for a giant change in one
go. Small, specific, reviewable steps beat one big generation every time.

## Routines

Routines are named, repeatable workflows stored in `docs/routines/`. Each one
documents a common task — what it does, when to use it, and the exact steps
Copilot will run. You trigger a routine by name:

> _"run the workspace-reset routine"_

Copilot reads the file and executes every step in order. You watch, verify each
result, and stop it if something looks wrong. The routine files are plain
Markdown — read them yourself before running one so you know what to expect.

| Routine         | Trigger phrase                    | Purpose                                           |
| :-------------- | :-------------------------------- | :------------------------------------------------ |
| workspace-reset | "run the workspace-reset routine" | Clear and rebuild the local environment from zero |

> **Why routines?** They give the team a shared vocabulary for common tasks,
> keep Copilot's behaviour predictable and auditable, and give junior developers
> a clear model of what's happening rather than a black box.

## Project skills

This repo ships a project-local Copilot plugin (`.github/plugin/`) that
registers skills specific to `aice-triage-automation`. Skills are richer than
routines — they are loaded by the Copilot plugin system and can compose other
skills.

To use a project skill, ask Copilot to invoke it by name:

> _"invoke the project-review skill"_

| Skill            | Plugin              | What it does                                                                         |
| :--------------- | :------------------ | :----------------------------------------------------------------------------------- |
| `project-review` | `aice-triage-local` | Full project health check: standards, code quality, docs accuracy, security, hygiene |

**One-time setup:** the plugin must be registered in your local Copilot config.
After cloning, run:

```bash
copilot plugin marketplace add /absolute/path/to/aice-triage-automation/.github/plugin
copilot plugin install aice-triage@aice-triage-local
```

For example:

```bash
copilot plugin marketplace add /Users/rdns/code/defra/aice-triage-automation/.github/plugin
copilot plugin install aice-triage@aice-triage-local
```

Then in a Copilot CLI session:

```text
/skills reload
/skills list
```

You should see `project-review` in the skills list.

> **Troubleshooting:** pass the marketplace directory path, not
> `marketplace.json`. If you pass a relative path that looks like `owner/repo`,
> Copilot may try to clone it from GitHub instead of reading it locally.

See `.github/plugin/skills/project-review/SKILL.md` to read exactly what the
review checks — always worth reading before running it.

> **Adoption note:** we should consider promoting `project-review` into the
> shared [DEFRA/defra-ai-plugins](https://github.com/DEFRA/defra-ai-plugins)
> marketplace so other Defra services can install and reuse it. Until then,
> contributors to this repo should consider installing the local
> `aice-triage-local` plugin so the skill is available in day-to-day work.

## Guardrails — the non-negotiables

These apply to **you** and to anything the AI produces on your behalf:

- **No secrets in code or prompts.** Use env/convict config. Never paste API
  keys, connection strings, or `.env` contents into a chat.
- **No PII or real data in prompts or logs.** Only OFFICIAL data is in scope.
  Don't paste real triage submissions or call transcripts into Copilot.
- **Human-in-the-loop is a product requirement, not a nicety.** The service
  proposes scores and drafts; a reviewer confirms or overrides. Don't let AI
  suggestions quietly remove an approval step.
- **The gates are not optional.** Lint, format, and tests must pass, and a human
  must review the PR, no matter how the code was written.
- **Verify claims.** If Copilot states a fact about the codebase, check it. It is
  confident even when wrong.

## You are accountable, not the model

If AI-assisted code ships a bug, "Copilot wrote it" is not an explanation — you
reviewed and merged it. That's the point of the review gates: they put a person
in front of every change. Use the assistant to go faster and learn quicker, but
own the result exactly as you would code you typed yourself.

## Where to go next

- New to the repo? Start with
  [`docs/first-time-dev-setup.md`](./first-time-dev-setup.md).
- Want the conventions in full? [`docs/coding-standards.md`](./coding-standards.md).
- Curious how it all fits together? [`docs/architecture.md`](./architecture.md).
- Want to see exactly what context Copilot gets?
  [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) — it's
  short, and reading it tells you what the assistant already "knows".
