---
name: project-review
description: Run a comprehensive health review of the aice-triage-automation project. Covers standards adherence, code quality, architectural consistency, documentation accuracy, security, and housekeeping — with callouts for areas an onboarding developer should study.
license: OGL-UK-3.0
---

# Project Review

A full-spectrum health check for `aice-triage-automation`. Work through every
section below in order. For each finding use one of these markers:

- ✅ **Good** — conforms; worth noting as a positive pattern
- ⚠️ **Attention** — minor issue or improvement opportunity
- ❌ **Fix** — should be addressed before the next release
- 📚 **Study** — a file or pattern an onboarding developer should read and understand

Present findings as a structured report:

1. A one-line overall health summary at the top
   (🟢 Healthy / 🟡 Needs attention / 🔴 Issues found)
2. A findings table: `item | section | status | action`
3. Detailed notes for every ⚠️, ❌, and 📚 item
4. A prioritised "What to fix next" list (❌ items only)

---

## 1. Quality gates

Run these and report the full output:

```bash
npm run format:check
npm run lint
npm test
```

- Any failure → ❌ Fix
- Coverage below 80% on any file → ⚠️ Attention
- Coverage below 50% on any file → ❌ Fix
- Run `npm audit --audit-level=high` and flag any vulnerabilities

Invoke the `defra-quality-gates` skill for the full quality-gate checklist.

---

## 2. Standards adherence

Read every file under `src/` and `tests/`. Check each against
`docs/coding-standards.md` and `.github/copilot-instructions.md`:

- ES modules only — no `require` / `module.exports`
- Named exports only — no `export default`
- `const` / `let` only — no `var`
- Function declarations for named functions; arrow functions (always with
  parens) for callbacks
- kebab-case filenames throughout
- Tests in `tests/` mirroring `src/`, imported via the `#/*` alias
- No hardcoded secrets, credentials, or PII

Flag any deviation as ❌ Fix and quote the offending line.

---

## 3. Code review

Read all files under `src/`.

### Architectural consistency

- Do routes stay thin — HTTP concerns only, no business logic?
- Does business logic live exclusively in `src/services/`?
- Is config centralised in `src/config.js` (convict), with no ad-hoc
  `process.env` reads elsewhere?
- Does each plugin own a single concern?
- Is `request.db` the only path to MongoDB in handlers and services? (Direct
  `MongoClient` use outside `tests/` is a ❌ Fix.)

### Code quality

- Are functions single-responsibility and clearly named?
- Are comments present where non-obvious decisions are made, and are they
  accurate? (Absent where obvious — no noise comments.)
- Are there any magic numbers, dead code, or `console.log` statements?
- Are there obvious redundancies — duplicated logic that should be extracted?
- Are Joi schemas used for all route input validation?

### Inconsistencies

- Are naming conventions consistent across files of the same type?
- Are similar patterns (error handling, response shapes, service calls) handled
  the same way throughout?

### 📚 Onboarding developer highlights

Call out 2–3 specific files or short code patterns that an onboarding developer
should read carefully before writing new code. For each, explain briefly:

- What it demonstrates
- Why it is done this way
- What would break if it were done differently

---

## 4. Documentation review

Cross-reference `docs/`, `README.md`, and `.github/copilot-instructions.md`
against the actual code. Check each claim for accuracy:

| Document                          | Check                                                                        |
| :-------------------------------- | :--------------------------------------------------------------------------- |
| `docs/architecture.md`            | Plugin chain table, route table, and ASCII diagrams match current `src/`     |
| `docs/first-time-dev-setup.md`    | `npm` scripts, Node/Docker versions, and troubleshooting steps still valid   |
| `docs/coding-standards.md`        | ESLint config, Prettier config, and deviations from CDP template still match |
| `docs/using-copilot.md`           | Routines table and skills table match actual `docs/routines/` and plugin     |
| `.github/copilot-instructions.md` | Conventions and routines table match current docs and code                   |
| `README.md`                       | Setup steps, endpoints, and proxy/Docker instructions still accurate         |

- Conflict between doc and code → ❌ Fix
- Potentially stale or misleading doc → ⚠️ Attention

**Diagrams:** Identify any relationship (plugin chain, request lifecycle, data
flow, local vs cloud) that would benefit from a diagram but does not have one.
Suggest the diagram type (sequence, component, flow) and its scope.

**External links:** Flag any concept that would benefit from a link to an
official resource but lacks one (Hapi.js docs, convict docs, Pino, CDP
platform docs, AICE JavaScript style guide, MongoDB Node driver).

---

## 5. Security

Invoke the `defra-security-pii` skill for the full Defra security checklist,
then check these project-specific items:

- All outbound HTTP in production must use `undici` with the CDP `ProxyAgent`
  — flag any `fetch`, `axios`, or `http` calls that bypass it as ❌ Fix
- Security headers confirmed in `src/server.js`: HSTS, X-Frame-Options,
  X-Content-Type-Options, X-XSS-Protection
- No `process.env` reads for secrets outside `src/config.js`
- Config validated at startup via convict — no unchecked env var reads
- Log lines do not contain user-supplied content, transcript text, or PII

---

## 6. Hygiene and housekeeping

- Any `TODO` / `FIXME` / `HACK` comments → ⚠️ Attention (suggest a ticket)
- `package.json` devDependencies used in no scripts or config → ⚠️ Attention
- Dependencies notably out of date (major version behind) → ⚠️ Attention
- `.gitignore` covers `.env`, `node_modules/`, `coverage/`, `.eslintcache`
- No build artefacts or `.env` files tracked by git
  (`git ls-files | grep -E '\.env$|node_modules|coverage'`)
- GitHub Actions workflow action versions are current (not non-existent or
  end-of-life tags)
- Sonar config (`sonar-project.properties`) points at correct test/source dirs
- `example.dependabot.yml` — is its template-only status clearly documented?
- `compose.yml` and associated `compose/` scripts still reflect the
  architecture described in `docs/architecture.md`
- `docs/routines/` entries are complete and their steps still work
