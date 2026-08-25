# Architecture

This document describes the components that make up `aice-triage-automation`
and how they fit together, both when running **locally** and when deployed to
Defra's **Core Delivery Platform (CDP)** in the cloud.

- [What the service does](#what-the-service-does)
- [Components](#components)
  - [The Hapi server](#the-hapi-server)
  - [Plugins](#plugins)
  - [Routes and services](#routes-and-services)
  - [Service-to-service authentication](#service-to-service-authentication)
  - [Configuration](#configuration)
- [Local setup](#local-setup)
- [Cloud setup (CDP)](#cloud-setup-cdp)
- [Local vs cloud at a glance](#local-vs-cloud-at-a-glance)

## What the service does

The AICE team triages incoming requests for AI use cases. This backend service
automates the legwork — drafting tickets and scoring use cases against a
rubric — while keeping a person accountable for every judgement. The reasoning
is delegated to a hosted AI model (Amazon Bedrock); a reviewer approves at each
stage.

The triage journey runs in five stages: **Intake → Transcript → Draft ticket →
Scoring → Decision**.

```
  Intake        Transcript      Draft ticket      Scoring          Decision
  (GOV.UK       (call           (agent drafts     (agent scores    (reviewer
   Forms)        transcript)     Jira ticket)      vs rubric,        confirms /
                                                   RAG ratings)      overrides)
    │               │                │                │                 │
    ▼               ▼                ▼                ▼                 ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                       aice-triage-automation                            │
  │                   (human review + approval at every stage)              │
  └────────────────────────────────────────────────────────────────────────┘
```

## Components

The service is a plain-JavaScript Node.js application built on **Hapi.js**,
scaffolded from the standard CDP Node.js backend template. The runtime is
assembled from a small set of focused pieces.

### The Hapi server

`src/index.js` is the entrypoint. It calls `startServer()`, which builds the
Hapi server via `createServer()` (`src/server.js`) and starts listening. The
server is configured with global request validation (Joi, via `failAction`),
security headers (HSTS, XSS protection, no-sniff, X-Frame), and trailing-slash
stripping.

```
  src/index.js
      │  startServer()
      ▼
  src/common/helpers/start-server.js
      │  createServer()
      ▼
  src/server.js  ──registers──▶  [ plugins ]  ──▶  Hapi listening on PORT
```

### Plugins

`createServer()` registers a chain of Hapi plugins, each owning one concern:

| Plugin           | File                             | Responsibility                                                  |
| :--------------- | :------------------------------- | :-------------------------------------------------------------- |
| `requestLogger`  | `src/plugins/request-logger.js`  | Structured request logging (hapi-pino).                         |
| `requestTracing` | `src/plugins/request-tracing.js` | Reads/propagates the CDP trace header (`x-cdp-request-id`).     |
| `metrics`        | `@defra/cdp-metrics`             | Emits CloudWatch EMF metrics.                                   |
| `secureContext`  | `@defra/hapi-secure-context`     | Loads CA certificates from environment config (TLS trust).      |
| `pulse`          | `src/plugins/pulse.js`           | Graceful shutdown handling (hapi-pulse), 10s timeout.           |
| `mongoDb`        | `src/plugins/mongodb.js`         | Mongo connection pool, indexes, and `mongo-locks` lock manager. |
| `jwtAuth`        | `src/plugins/jwt-auth.js`        | The `jwt` auth strategy. Registered, never made the default.    |
| `router`         | `src/plugins/router.js`          | Registers the application routes.                               |

`jwtAuth` **must be registered before `router`**: Hapi wants a strategy to exist
before a route naming it is added, and throws at start-up otherwise.

The `mongoDb` plugin decorates both `server` and `request` with `db` and
`locker`, so handlers reach the database via `request.db` and acquire write
locks via `request.locker`.

```
                         createServer()
                              │
        ┌──────────┬──────────┼──────────┬──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼          ▼
   requestLogger  tracing   metrics  secureContext  pulse    mongoDb ─ jwtAuth ─ router
        │                                                       │         │        │
     logs/EMF                                               MongoDB   `jwt`      routes
                                                                      strategy
```

### Routes and services

Routes live in `src/routes/` and are aggregated by the router plugin. Business
logic lives in `src/services/`, kept separate from HTTP concerns so handlers
stay thin.

| Endpoint                                 | Handler                     | Notes                                                                                                                                 |
| :--------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                            | `src/routes/health.js`      | Liveness probe — required by CDP.                                                                                                     |
| `POST /score`                            | `src/routes/score.js`       | Scores text supplied in the request. Stateless — nothing is read from or written to Mongo.                                            |
| `POST /submissions`                      | `src/routes/submissions.js` | Stores a submission unprocessed. Returns `202`, and is an upsert, so re-posting is safe. **The one authenticated route** — see below. |
| `GET /submissions?status=`               | `src/routes/submissions.js` | Lists submissions of one status (`unprocessed` or `scored`), newest first.                                                            |
| `GET /submissions/{submissionId}`        | `src/routes/submissions.js` | One stored submission, or `404`.                                                                                                      |
| `POST /submissions/{submissionId}/score` | `src/routes/submissions.js` | Scores a stored submission under a Mongo lock. Already scored returns the stored result; a held lock returns `409`.                   |
| `GET /example`                           | `src/routes/example.js`     | Template example (remove as needed).                                                                                                  |
| `GET /example/{id}`                      | `src/routes/example.js`     | Template example (remove as needed).                                                                                                  |

```
   HTTP request ──▶ router ──▶ route handler ──▶ service ──▶ request.db ──▶ MongoDB
                                  (src/routes)   (src/services)
```

### Service-to-service authentication

`POST /submissions` is the route a public-facing service posts to: the AI
digital toolkit's triage form in
[`service-manual-ui`](https://github.com/DEFRA/service-manual-ui). It is the
only route here that authenticates its caller.

**The allow-list holds CDP service names, read from a token rather than
guessed.** A WebIdentity token's `sub` is the caller's role ARN, in the form
`arn:aws:iam::<account>:role/<cdp-service-name>` — the shape confirmed on
26 August 2026 by decoding a real Dev token, which carried it along with a
matching `ServiceName` principal tag. The caller here is the CDP service
`service-manual-ui`, which happens to equal its repository name; its own `sub`
is expected to follow that shape and should be read once per environment before
`enforce`, which is what `audit` mode is for.

**Do not assume the two always match, and do not read the name off the first
container to hand.** DEFRA runs a separate, dormant service called
`ai-service-manual` — a different repository, with no triage code in it — whose
name is close enough to this caller's that a terminal opened on the wrong one
gives a plausible, wrong answer, and an allow-list entry that matches nothing.
That failure arrives as a `403` after signature, issuer and audience all
validate: the shape that looks least like a naming problem. Take `sub` from a
token decoded on the container that actually serves `/ai-toolkit`, once per
environment.

The mechanism is the one the Core Delivery Platform recommends, **AWS
WebIdentity tokens**. The caller asks the AWS Security Token Service for a
short-lived JWT signed by AWS, with an audience naming this service, and sends
it as `Authorization: Bearer …`. This service verifies the signature against the
platform's published public keys, checks the issuer and audience, and reads the
token's `sub` — the caller's task-role ARN — to learn which service called.

```
  service-manual-ui                          aice-triage-automation
        │                                             │
        │ 1. GetWebIdentityToken                      │
        │    (audience: aice-triage-automation)       │
        ▼                                             │
    AWS STS ──── signed JWT ────▶ │                   │
                                  │ 2. POST /submissions
                                  │    Authorization: Bearer …
                                  └──────────────────▶│
                                                      │ 3. verify signature,
                                                      │    issuer, audience
                                                      ▼
                            forward proxy ──▶ JWKS ( *.tokens.sts.global.api.aws )
                                                      │
                                                      │ 4. is `sub` an allowed caller?
                                                      ▼
                                              202 · 401 · 403
```

**Three modes**, chosen by `AUTH_MODE`, so the rollout can prove tokens are
arriving before anything depends on them:

| Mode      | Behaviour                                                                                                                                                                           |
| :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off`     | The header is not looked at. The route behaves exactly as it did before. The default, and what runs locally and in tests.                                                           |
| `audit`   | Full validation, the outcome logged with the subject and any failure reason — then the request is served either way. Nothing is rejected.                                           |
| `enforce` | Full validation, and rejection: `401` for a missing, malformed, expired, wrongly-issued or wrongly-audienced token; `403` for a valid token whose subject is not on the allow-list. |

`audit` is the mode that earns the other two: it is the only point at which you
learn tokens are arriving and validating **before** anything depends on it.
Rolling back at any point is `AUTH_MODE=audit`, which stops rejection while
leaving the logging in place.

**Only this route is protected.** `GET /submissions`,
`GET /submissions/{submissionId}` and `POST /submissions/{submissionId}/score`
are called by
[`aice-triage-frontend`](https://github.com/DEFRA/aice-triage-frontend), which
sends no token; giving it one is work in a third repository. `/health` must stay
open — the platform's health check calls it unauthenticated. Because the
strategy is applied per route rather than as a default, **a route added later is
unauthenticated unless somebody remembers**. If the remaining routes are ever
protected, switch to a default strategy with explicit exemptions at the same
time.

**Two decisions worth knowing:**

- **A JWKS endpoint that cannot be reached answers `503`, not `401`.**
  `createRemoteJWKSet` fetches lazily, so an unreachable key server surfaces on
  the first request rather than at boot. Answering `401` would send whoever is
  debugging it after a token that was perfectly good. Only jose's token-shaped
  error codes become `401`; everything else is ours, and says so in the log.
- **The key fetch is given its own proxied client.** All platform egress goes
  through the forward proxy and the keys live outside it. Nothing here sets a
  global undici dispatcher and `NODE_USE_ENV_PROXY` is not set either, so a
  plain `fetch` would go direct and hang. `keySetFetch` builds a `ProxyAgent`
  from `HTTP_PROXY` whenever it is set — every deployed environment, and no
  local one.

**Nothing in the test suite calls AWS.** `tests/plugins/jwt-auth.test.js`
generates a key pair with `jose`, signs its own tokens, and hands the plugin the
matching public key set through the `createServer({ auth: { keySet } })` seam.

### Configuration

`src/config.js` uses **convict** to centralise configuration, validated
strictly at startup. Every setting has a sane default and an environment-
variable override (`PORT`, `MONGO_URI`, `ENVIRONMENT`, `LOG_*`, `HTTP_PROXY`,
`TRACING_HEADER`, `AUTH_*`, …). `NODE_ENV` switches log format between human-readable
`pino-pretty` (development) and structured `ecs` JSON (production).

**`NODE_ENV` comes from the base image, not from us.** The production image
starts the service with `node src` rather than the npm `start` script, so
nothing in this repo exports it — but `defradigital/node` sets
`NODE_ENV=production` itself, and `defradigital/node-development` sets
`development`. A deployed container therefore already logs `ecs` JSON and
already takes the narrow `log.redact` list. `LOG_FORMAT` and `LOG_REDACT` are
available in `cdp-app-config` as operator control, not as required corrections.

Verify rather than assume, if the base image version ever moves:

```bash
docker run --rm --entrypoint sh defradigital/node:<tag> -c 'echo $NODE_ENV'
```

**Bedrock calls are non-streaming, deliberately.** `@strands-agents/sdk` takes
the `ConverseStream` API unless a model is constructed with `stream: false`, and
`ConverseStream` requires `bedrock:InvokeModelWithResponseStream` — an action the
CDP task role is not granted, though plain `bedrock:InvokeModel` is. Deployed
scoring fails with `AccessDeniedException` without it. Nothing here streams to a
user, so the streaming API buys nothing. Local runs cannot catch this: on a
laptop the SDK authenticates with `AWS_BEARER_TOKEN_BEDROCK`, whose permissions
are the API key's rather than the task role's.
`tests/agents/engine-bedrock.test.js` asserts both models stay non-streaming.

**The production image installs with `npm ci --omit=dev`.** Anything in
`devDependencies` is absent at runtime, so a static `import` of one crashes the
container on boot with `ERR_MODULE_NOT_FOUND` — before any config is read, which
means no environment variable can rescue it. Load such packages lazily on the
branch that needs them, as `src/plugins/logger-options.js` does for
`pino-pretty`. `tests/production-dependencies.test.js` guards this.

## Local setup

Locally the service and its backing infrastructure run via **Docker Compose**
(`compose.yml`) on a shared `cdp-tenant` bridge network. AWS services are
emulated by **Floci** (a LocalStack-style mock) so nothing reaches real AWS.

```
  Developer machine
  ┌──────────────────────────── docker network: cdp-tenant ───────────────────────────┐
  │                                                                                     │
  │   ┌─────────────────────────┐      ┌──────────────┐      ┌────────────────────┐     │
  │   │ aice-triage-automation  │─────▶│   mongodb    │      │       redis        │     │
  │   │  (target: development)  │      │  :27017      │      │      :6379         │     │
  │   │  :3001  node --watch    │      └──────────────┘      └────────────────────┘     │
  │   │  ./src bind-mounted     │                                                       │
  │   └───────────┬─────────────┘      ┌──────────────────────────────────────────┐    │
  │               └───────────────────▶│  floci  :4566  (mock S3 / SQS / SNS …)    │    │
  │                                     └──────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────────────────────────────┘
         ▲
         │  http://localhost:3001
     Developer
```

Key local characteristics:

- **Hot reload** — `npm run dev` runs `node --watch`; `./src` is bind-mounted
  into the container, so edits restart the server.
- **Mocked AWS** — Floci stands in for S3/SQS/SNS etc. Mock resources are
  seeded from `compose/floci/start.d/`.
- **Seeded Mongo** — initial records come from `compose/mongo/`.
- **Pretty logs** — `LOG_FORMAT=pino-pretty`, `ENVIRONMENT=local`.
- **No TLS/proxy** — secure-context CAs and the forward proxy are not needed.
- **No caller authentication** — `AUTH_MODE` defaults to `off`. Floci and
  similar tools do not implement the STS `GetWebIdentityToken` endpoint, so
  there is no token to send or to check.

You can also run the service directly on the host with `npm run dev` (pointing
at a local MongoDB on `127.0.0.1:27017`) without Compose.

## Cloud setup (CDP)

In the cloud the **production** Docker image (`Dockerfile` `production` target)
runs on Defra's Core Delivery Platform. The same application code talks to
managed infrastructure instead of local containers, and traffic flows through
CDP's platform services.

```
                         ┌─────────────────────────────┐
   GOV.UK Forms /        │      CDP platform / ALB      │
   upstream callers ────▶│   (TLS, routing, auth)       │
                         └───────────────┬─────────────┘
                                         │  /health probe + traffic
                                         ▼
        ┌────────────────────────────────────────────────────────┐
        │            aice-triage-automation (container)           │
        │   NODE_ENV=production · ecs JSON logs · EMF metrics     │
        └───┬──────────────┬───────────────┬──────────────┬───────┘
            │              │               │              │
            ▼              ▼               ▼              ▼
      ┌──────────┐   ┌──────────┐   ┌─────────────┐  ┌──────────────┐
      │ MongoDB  │   │ Forward  │   │ CloudWatch  │  │ Amazon AWS   │
      │ (managed)│   │  proxy   │   │ (EMF/logs)  │  │ S3/SQS/SNS/  │
      └──────────┘   └────┬─────┘   └─────────────┘  │ Bedrock      │
                          │                          └──────────────┘
                          ▼  all outbound HTTP egress
                    external services
```

Key cloud characteristics:

- **Managed MongoDB** — connection details injected via `MONGO_URI`.
- **Forward proxy** — all outbound HTTP egress goes through the CDP proxy
  (`HTTP_PROXY` / undici `ProxyAgent`); see the README "Proxy" section.
- **Secure context** — CA certificates loaded from environment config for TLS
  trust against platform services.
- **Real AWS** — S3/SQS/SNS and Amazon Bedrock (the hosted AI model) instead of
  Floci.
- **Structured observability** — `ecs` JSON logs and EMF metrics shipped to
  CloudWatch; requests carry the `x-cdp-request-id` trace header.
- **Health checks** — CDP polls `GET /health`; `curl` is baked into the
  production image for the platform health check.
- **Caller authentication** — `POST /submissions` validates an AWS WebIdentity
  token against the platform's JWKS endpoint, per `AUTH_MODE`. The platform
  supplies `CDP_JWT_ISSUER`, `CDP_JWT_JWKS_URI` and `AWS_ACCOUNT`.

## Local vs cloud at a glance

| Concern       | Local                                 | Cloud (CDP)                      |
| :------------ | :------------------------------------ | :------------------------------- |
| Image target  | `development` (`Dockerfile`)          | `production` (`Dockerfile`)      |
| Run command   | `npm run docker:dev` (`node --watch`) | `node src`                       |
| Code source   | `./src` bind-mounted, hot reload      | Baked into the image             |
| MongoDB       | `mongo:7` container                   | Managed MongoDB                  |
| AWS services  | Floci mock (`:4566`)                  | Real AWS (S3/SQS/SNS/Bedrock)    |
| Redis         | `redis:7` container                   | Managed / as provisioned         |
| Logs          | `pino-pretty`                         | `ecs` JSON → CloudWatch          |
| Metrics       | EMF (`AWS_EMF_ENVIRONMENT=Local`)     | EMF → CloudWatch                 |
| Outbound HTTP | Direct                                | Via forward proxy (`HTTP_PROXY`) |
| TLS trust     | Not required                          | `secureContext` CA certificates  |
| `ENVIRONMENT` | `local`                               | `dev` / `test` / `prod` / …      |
| Caller auth   | `AUTH_MODE=off` (STS is unavailable)  | `off` → `audit` → `enforce`      |

---

See also the [First-Time Dev Setup guide](./first-time-dev-setup.md) for a
step-by-step walkthrough of getting the service running locally.
