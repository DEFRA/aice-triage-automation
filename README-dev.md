# Local dev helpers

Notes for exercising the submissions API locally against the frontend
(`aice-triage-frontend`) without wiring up real intake or a live Bedrock
model.

## Prerequisites

Run the service in development mode so the dev-only routes are registered
(they are guarded behind `NODE_ENV=development` — see
`src/config.js` / `src/plugins/router.js`):

```bash
npm run dev
```

## Seed a submission

`POST /_dev/seed-submission` creates an `unprocessed` submission with a
generated `submissionId` (format `SUB-YYYY-NNNN`), so you don't need to invent
one by hand:

```bash
curl -X POST http://localhost:3001/_dev/seed-submission \
  -H 'Content-Type: application/json' \
  -d '{"text":"test"}'
```

Optionally include `submittedAt` (ISO 8601):

```bash
curl -X POST http://localhost:3001/_dev/seed-submission \
  -H 'Content-Type: application/json' \
  -d '{"text":"Local test submission","submittedAt":"2026-07-22T09:15:00.000Z"}'
```

Responds `201` with the created submission document.

## Endpoints the frontend calls

- `GET /submissions?status=unprocessed` — list unprocessed submissions
  (`[]` when there are none):

  ```bash
  curl -sv "http://localhost:3001/submissions?status=unprocessed"
  ```

- `POST /submissions/{submissionId}/score` — score a submission. Returns
  `200` with `{ id, kind, reason, scoring }` on success, or `409` if that
  submission is already being scored:

  ```bash
  curl -X POST http://localhost:3001/submissions/SUB-2026-0001/score
  ```

- `GET /health` — `200 { "message": "success" }`.

## Notes

- These dev routes read and write the same MongoDB-backed `submissions`
  collection as the real endpoints — there is no separate in-memory store —
  so seeded submissions show up in `GET /submissions` and can be scored like
  any other submission.
- `_dev/*` routes are not registered unless `NODE_ENV=development`, so they
  never exist in `test` or `production`.
