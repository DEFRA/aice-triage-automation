# First-Time Dev Setup

**Target:** Getting `aice-triage-automation` running locally from a fresh clone.

This guide walks you from a fresh checkout to a running, hot-reloading dev
server with passing tests. It also explains _why_ the local dev tooling is set
up the way it is — including two fixes that keep `npm run dev` working on
Node 24 — so that when something breaks you understand the moving parts rather
than just copy-pasting commands.

Read it top to bottom the first time. After that, the [TL;DR](#tldr) at the end
is all you need.

---

## Overview

`aice-triage-automation` is a Hapi.js backend (plain JavaScript, ES modules)
scaffolded from Defra's CDP Node.js template. For local development it needs
exactly one external service: **MongoDB**. Everything else (AWS via Floci,
Redis) is optional infrastructure used by the full Docker Compose stack but not
required to boot the app.

There are two ways to run it locally:

1. **App on host, Mongo in Docker** — fastest inner loop, best debugger
   experience. This is the recommended day-to-day setup.
2. **Everything in Docker Compose** — closest to the deployed environment,
   includes Floci (mocked AWS) and Redis.

Both are covered below.

---

## 1. Prerequisites

| Tool           | Version                                     | Check            |
| :------------- | :------------------------------------------ | :--------------- |
| Node.js        | `>= 24` (repo pins `v24.14.1` via `.nvmrc`) | `node --version` |
| npm            | `>= 11`                                     | `npm --version`  |
| Docker Desktop | any recent                                  | `docker info`    |

The project pins Node in two places — keep them in mind:

```
// .nvmrc
v24.14.1
```

```json
// package.json
"engines": {
  "node": ">=24"
}
```

If you use [nvm](https://github.com/nvm-sh/nvm):

```bash
cd aice-triage-automation
nvm use   # reads .nvmrc
```

> **Why the version matters:** Node's `--watch` mode (used by `npm run dev`)
> behaves differently across 24.x patch releases. Node `< 24.18` crashes when
> asked to watch a missing `--env-file`. The Docker image pins `24.14.1`, so the
> repo carries a fix for exactly that case — see [section 6](#6-why-the-dev-mode-fixes-exist).

---

## 2. Install dependencies

```bash
npm install
```

This installs ~520 packages. A clean install should report `found 0
vulnerabilities`. No `.env` file is required to start — every config value has a
sensible default (see [section 5](#5-configuration-and-the-env-file)).

Run the first-time setup helper to install and verify git hooks:

```bash
npm run setup:first-time
```

This runs `git:hooks` and then `verify:git-hooks` to confirm Husky is
configured (`core.hooksPath=.husky/_`) and the pre-commit hook is present.

If you ever need to repair hooks manually, run:

```bash
npm run git:hooks
npm run verify:git-hooks
```

If you use GitHub Copilot CLI and want project-local skills (for example
`project-review`), register the local plugin marketplace once:

```bash
copilot plugin marketplace add /absolute/path/to/aice-triage-automation/.github/plugin
copilot plugin install aice-triage@aice-triage-local
```

Then verify in an interactive Copilot session:

```text
/skills reload
/skills list
```

---

## 3. Start MongoDB

The app defaults to `mongodb://127.0.0.1:27017/`. The simplest way to provide
that is to start just the Mongo container from the Compose file:

```bash
docker compose up -d mongodb
```

Verify it's healthy:

```bash
docker compose ps          # mongodb should show "Up (healthy)"
```

The Mongo service is defined in `compose.yml` with a healthcheck so dependent
services wait for it:

```yaml
# compose.yml
mongodb:
  image: mongo:7.0.28
  ports:
    - '27017:27017'
  healthcheck:
    test: ['CMD', 'mongosh', '--eval', 'db.hello().ok']
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 30s
```

> **Note:** If Docker Desktop isn't running, `docker compose` fails with
> _"Cannot connect to the Docker daemon."_ Start Docker Desktop first
> (`open -a Docker` on macOS) and wait for `docker info` to succeed.

---

## 4. Run the app in dev mode

```bash
npm run dev
```

You should see pretty-printed (colourised) logs ending with:

```
[12:03:44.987] INFO (46): server started
[12:03:44.988] INFO (46): Server started successfully
[12:03:44.988] INFO (46): Access your backend on http://localhost:3001
```

`npm run dev` runs `node --watch`, so editing any file under `src/`
auto-restarts the server. Verify the two example endpoints:

```bash
curl http://localhost:3001/health    # {"message":"success"}
curl http://localhost:3001/example   # []  (empty until data exists)
```

### How startup actually works

The entry point is tiny — it just starts the server and installs a last-resort
error handler:

```js
// src/index.js
await startServer()

process.on('unhandledRejection', (error) => {
  const logger = createLogger()
  logger.info('Unhandled rejection')
  logger.error(error)
  process.exitCode = 1
})
```

`startServer()` builds the Hapi server, starts it, and logs the URL:

```js
// src/common/helpers/start-server.js
export async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )

  return server
}
```

`createServer()` (in `src/server.js`) registers the plugins — including the
Mongo connection and the request logger — which is where the dev-mode fixes in
[section 6](#6-why-the-dev-mode-fixes-exist) come into play.

---

## 5. Configuration and the `.env` file

Config is centralised in `src/config.js` using [convict](https://github.com/mozilla/node-convict).
Every value has a default and an env-var override. The two you care about most
locally:

```js
// src/config.js (excerpt)
port: {
  default: 3001,
  env: 'PORT'
},
mongo: {
  mongoUrl: {
    default: 'mongodb://127.0.0.1:27017/',
    env: 'MONGO_URI'
  }
}
```

Because of these defaults, **you do not need a `.env` file to run locally.**
If you want to override something, create a `.env` (it's gitignored) and the dev
scripts will pick it up via Node's `--env-file-if-exists=.env`:

```bash
# server:watch
node --watch --inspect=0.0.0.0 --env-file-if-exists=.env ./src
```

Example `.env`:

```
LOG_LEVEL=debug
MONGO_DATABASE=aice-triage-automation
```

---

## 6. Why the dev-mode fixes exist

The repo carries two small fixes to keep `npm run dev` working on Node 24. You
don't need to do anything to use them — but understanding them will save you
hours if dev mode ever misbehaves again.

### Fix 1 — pino-pretty as an in-process stream (not a worker thread)

pino can format logs prettily two ways: as a **worker-thread transport**, or as
a **synchronous in-process stream**. The CDP template originally used the
transport:

```js
// before — crashed under `node --watch` on Node 24
'pino-pretty': { transport: { target: 'pino-pretty' } }
```

The transport spawns a worker thread (`thread-stream`). Under `node --watch`
on Node 24 that worker crashes on boot with `Error: this should not happen:
undefined`, taking the whole dev server down. The fix builds pino-pretty as a
plain stream instead — no worker thread, no crash:

```js
// src/plugins/logger-options.js
// For pino-pretty we attach the formatter as a synchronous, in-process stream
// (see loggerStream below) rather than as a worker-thread transport. pino's
// transport worker (thread-stream) crashes under `node --watch` on Node 24,
// which breaks `npm run dev`. A direct stream avoids the worker thread entirely.
export const loggerStream =
  logConfig.format === 'pino-pretty' ? pinoPretty() : undefined
```

That stream is then handed to both log consumers — the standalone logger:

```js
// src/common/helpers/logging/logger.js
const logger = loggerStream
  ? pino(loggerOptions, loggerStream)
  : pino(loggerOptions)
```

…and the Hapi request logger plugin:

```js
// src/plugins/request-logger.js
export const requestLogger = {
  plugin: hapiPino,
  options: {
    ...loggerOptions,
    ...(loggerStream ? { stream: loggerStream } : {})
  }
}
```

**Important:** `loggerStream` is only defined when the log format is
`pino-pretty` (i.e. local dev). In production the format is `ecs`, `loggerStream`
is `undefined`, and logging falls back to the original stdout-JSON behaviour.
**Production logging is unchanged.**

### Fix 2 — ensure `.env` exists inside the Docker dev image

`npm run dev` uses `node --watch --env-file-if-exists=.env`. Node's watch mode
registers the env-file path to watch **even when the file is absent**, and
Node `< 24.18` then crashes with `ENOENT` trying to watch it. The Docker dev
image pins Node `24.14.1`, so it hits this. The fix simply guarantees the file
exists:

```dockerfile
# Dockerfile (development stage)
# `npm run dev` uses `node --watch --env-file-if-exists=.env`. Node's watch mode
# registers the env-file path even when the file is absent, and Node < 24.18
# crashes with ENOENT trying to watch it. Ensure the file exists in the image.
RUN touch .env
```

The host doesn't need this fix if you're on Node `>= 24.18` (the bug is fixed
there) — but creating an empty `.env` locally is harmless and avoids surprises.

---

## 7. Run the tests

```bash
npm test          # single run with coverage
npm run test:watch  # re-run on change
```

Tests use [vitest](https://vitest.dev/) with `vitest-mongodb`, which spins up an
**in-memory MongoDB** — so the test suite needs **no running Mongo container**.
A clean run reports all tests passing (`Test Files … passed`, `Tests … passed`)
with a coverage table.

Lint and formatting:

```bash
npm run lint          # eslint (neostandard config)
npm run lint:fix
npm run format:check  # prettier
npm run format
```

---

## 8. Full Docker Compose stack (alternative)

To run the app _and_ all its infrastructure (Floci/AWS mock, Redis, Mongo) in
containers:

```bash
docker compose up --build -d
```

The app container runs the same `npm run dev` (hot-reload works because `./src`
is bind-mounted). It exposes the app on `http://localhost:3001`. Mocked AWS
resources can be seeded by editing scripts under `./compose/floci/start.d/`.

Manage the stack:

```bash
docker compose ps            # status of all services
docker compose logs -f aice-triage-automation
docker compose stop aice-triage-automation   # free :3001 to run the app on host
docker compose down          # tear everything down
```

> **Port clash:** the host `npm run dev` and the Compose `aice-triage-automation`
> service both bind `:3001`. Run one or the other, not both.

---

## 9. Production mode (local sanity check)

To mimic production locally (ECS JSON logs, no `--watch`):

```bash
npm start
```

This sets `NODE_ENV=production`, which switches the log format to `ecs`
(structured JSON) — the same format CDP uses. Useful for confirming the app
boots cleanly without any dev tooling involved.

---

## 10. Troubleshooting

| Symptom                                                                  | Cause                                           | Fix                                                                                                              |
| :----------------------------------------------------------------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon`                                    | Docker Desktop not running                      | Start Docker, wait for `docker info` to pass                                                                     |
| Dev server exits with `Error: this should not happen: undefined`         | pino-pretty worker thread under `--watch`       | Should be fixed (section 6.1); confirm `logger-options.js` builds `loggerStream`, not a transport                |
| Docker app container crash-loops with `ENOENT … watch '/home/node/.env'` | Missing `.env` in image under `--watch`         | Should be fixed (section 6.2); confirm `RUN touch .env` in the Dockerfile dev stage, then `docker compose build` |
| `EADDRINUSE :3001`                                                       | App already running (host or container) on 3001 | Stop the other one (`docker compose stop aice-triage-automation` or kill the host process)                       |
| App starts but Mongo errors                                              | No Mongo on `:27017`                            | `docker compose up -d mongodb`                                                                                   |

---

## TL;DR

```bash
nvm use                          # Node 24
npm install                      # deps
docker compose up -d mongodb     # Mongo on :27017
npm run dev                      # app on :3001, hot-reload
# in another shell:
curl http://localhost:3001/health   # {"message":"success"}
npm test                         # in-memory Mongo, no container needed
```

---

## Summary

After this guide you can: install dependencies, stand up MongoDB (container or
full Compose stack), run the hot-reloading dev server, run the test suite, and
mimic production locally. You also know the two non-obvious things about this
project's dev tooling:

- **Logging in dev uses an in-process pino-pretty stream**, not a worker-thread
  transport, because the worker crashes under `node --watch` on Node 24.
  Production (`ecs` format) is untouched.
- **The Docker dev image creates an empty `.env`** so `node --watch` doesn't
  `ENOENT` on a missing env file under Node `< 24.18`.

The fragile spot to watch: anything that reintroduces a pino **transport** (a
worker thread) into the dev log path will likely break `npm run dev` again on
Node 24. Keep dev logging on the in-process stream.
