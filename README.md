# aice-triage-automation

Backend service that automates the AI Capability and Enablement (AICE) team's AI
use-case triage process.

- [About this service](#about-this-service)
- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Local development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Testing](#testing)
  - [Coding standards](#coding-standards)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [API endpoints](#api-endpoints)
- [Development helpers](#development-helpers)
  - [MongoDB Locks](#mongodb-locks)
  - [Proxy](#proxy)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## About this service

The AICE team triages incoming requests for AI use cases: a request comes in, a
short triage call is held, and the team scores the opportunity against a fixed
rubric before deciding whether to take it forward. Today that work is manual.

This service automates the legwork while keeping a person accountable for every
judgement. An AI agent reads the triage rules, asks a hosted AI model
(Amazon Bedrock) to do the heavy reasoning, and proposes scores and draft
tickets — but it never decides on its own. The triage journey runs in five
stages:

1. **Intake** — a use-case request arrives (via a GOV.UK Forms submission).
2. **Transcript** — the recorded triage call's transcript is captured.
3. **Draft ticket** — the agent drafts a Jira ticket from the transcript.
4. **Scoring** — the agent scores the use case against the rubric, giving each
   criterion a red / amber / green (RAG) rating with a written rationale.
5. **Decision** — a reviewer confirms or overrides the scores and the panel
   decides the outcome.

A person reviews and approves at every stage; the agent runs under cost and
time limits, and only OFFICIAL information is handled.

The service is built in plain JavaScript on Node.js, validates data with Joi,
and runs on Defra's Core Delivery Platform (CDP). It is scaffolded from the
standard CDP Node.js backend template (Hapi.js), so the sections below describe
the platform conventions it inherits.

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `>= v24` and [npm](https://nodejs.org/) `>= v11`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd aice-triage-automation
nvm use
```

## Local development

> **New to this project?** See the
> [First-Time Dev Setup guide](./docs/first-time-dev-setup.md) for a step-by-step
> walkthrough (install → MongoDB → `npm run dev` → tests) and an explanation of
> the dev-mode tooling.

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Testing

To test the application run:

```bash
npm run test
```

Tests live in the root `tests/` directory, mirroring the `src/` structure (this
differs from the CDP template, which colocates tests). See
[Coding standards](./docs/coding-standards.md) for details.

### Coding standards

This service follows the
[DEFRA AICE JavaScript style guide](https://github.com/DEFRA/aice-team/blob/main/style-guides/javascript.md),
enforced via ESLint (neostandard) and Prettier. See
[docs/coding-standards.md](./docs/coding-standards.md) for the conventions and
for where this repo deliberately deviates from the CDP Node.js template.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json).
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## API endpoints

| Endpoint             | Description                    |
| :------------------- | :----------------------------- |
| `GET: /health`       | Health                         |
| `GET: /example    `  | Example API (remove as needed) |
| `GET: /example/<id>` | Example API (remove as needed) |

## Development helpers

### MongoDB Locks

If you require a write lock for Mongo you can acquire it via `server.locker` or `request.locker`:

```javascript
async function doStuff(server) {
  const lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  try {
    // do stuff
  } finally {
    await lock.free()
  }
}
```

Keep it small and atomic.

You may use **using** for the lock resource management.
Note test coverage reports do not like that syntax.

```javascript
async function doStuff(server) {
  await using lock = await server.locker.lock('unique-resource-name')

  if (!lock) {
    // Lock unavailable
    return
  }

  // do stuff

  // lock automatically released
}
```

Helper methods are also available in `/src/helpers/mongo-lock.js`.

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Docker

Build:

```bash
docker build --no-cache --tag aice-triage-automation .
```

Run:

```bash
docker run -e PORT=3001 -p 3001:3001 aice-triage-automation
```

### Docker Compose

A local environment with:

- Floci for AWS services (S3, SQS, SNS etc)
- Redis
- MongoDB
- This service.
- A commented out frontend example.

```bash
docker compose up --build -d
```

Mock AWS resources can be created when Floci starts up by editing the scripts in `./compose/floci/start.d/`.
MongoDB records can also be created when Mongo starts by editing the scripts in `./compose/mongo/`.

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
