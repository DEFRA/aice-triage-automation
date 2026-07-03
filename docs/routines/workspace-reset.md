# Routine: workspace-reset

**Trigger phrase:** _"run the workspace-reset routine"_

## Purpose

Simulate a fresh clone to verify the project sets up correctly from scratch.
Use this to check the setup guide is accurate, to clear accumulated state
before a pairing session, or to diagnose a broken local environment.

## Steps

Copilot executes these in order. Do not skip steps.

### 1. Remove installed artefacts

```bash
rm -rf node_modules coverage .eslintcache
```

### 2. Check Node.js and npm versions meet requirements

```bash
node --version   # must be >= v24
npm --version    # must be >= v11
```

### 3. Install dependencies

```bash
npm install
```

Expected: N packages installed, `found 0 vulnerabilities`.

### 4. Run first-time setup

Installs and verifies the Husky pre-commit hook:

```bash
npm run setup:first-time
```

Expected: `Git hooks are installed and configured correctly`.

### 5. Run the test suite

```bash
npm test
```

Expected: all test files pass, coverage table printed.

## Expected outcome

A clean, verified local environment equivalent to a fresh clone. Every step
prints what it did; if something fails, the output tells you exactly what to
fix before continuing.

---

> **Note:** this routine does not start the dev server or MongoDB — those are
> optional steps after the baseline is confirmed. See
> [`docs/first-time-dev-setup.md`](../first-time-dev-setup.md) for the full
> walkthrough including Docker Compose.
