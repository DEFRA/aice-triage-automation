# Architecture

This document describes the components that make up `aice-triage-automation`
and how they fit together, both when running **locally** and when deployed to
Defra's **Core Delivery Platform (CDP)** in the cloud.

- [What the service does](#what-the-service-does)
- [Components](#components)
  - [The Hapi server](#the-hapi-server)
  - [Plugins](#plugins)
  - [Routes and services](#routes-and-services)
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
| `router`         | `src/plugins/router.js`          | Registers the application routes.                               |

The `mongoDb` plugin decorates both `server` and `request` with `db` and
`locker`, so handlers reach the database via `request.db` and acquire write
locks via `request.locker`.

```
                         createServer()
                              │
        ┌──────────┬──────────┼──────────┬──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼          ▼
   requestLogger  tracing   metrics  secureContext  pulse    mongoDb ── router
        │                                                       │        │
     logs/EMF                                               MongoDB    routes
```

### Routes and services

Routes live in `src/routes/` and are aggregated by the router plugin. Business
logic lives in `src/services/`, kept separate from HTTP concerns so handlers
stay thin.

| Endpoint            | Handler                 | Notes                                |
| :------------------ | :---------------------- | :----------------------------------- |
| `GET /health`       | `src/routes/health.js`  | Liveness probe — required by CDP.    |
| `GET /example`      | `src/routes/example.js` | Template example (remove as needed). |
| `GET /example/{id}` | `src/routes/example.js` | Template example (remove as needed). |

```
   HTTP request ──▶ router ──▶ route handler ──▶ service ──▶ request.db ──▶ MongoDB
                                  (src/routes)   (src/services)
```

### Configuration

`src/config.js` uses **convict** to centralise configuration, validated
strictly at startup. Every setting has a sane default and an environment-
variable override (`PORT`, `MONGO_URI`, `ENVIRONMENT`, `LOG_*`, `HTTP_PROXY`,
`TRACING_HEADER`, …). `NODE_ENV` switches log format between human-readable
`pino-pretty` (development) and structured `ecs` JSON (production).

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

---

See also the [First-Time Dev Setup guide](./first-time-dev-setup.md) for a
step-by-step walkthrough of getting the service running locally.
