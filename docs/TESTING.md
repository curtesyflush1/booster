# Testing & CI Lanes

This repo uses three lanes to balance speed, determinism, and coverage.

## Lanes

- Unit (fast)
  - Scope: isolated logic; heavy effects mocked (auth, rate limiting, external services).
  - Commands:
    - `cd backend && npm run test:unit`
  - Env flags (often enabled in CI):
    - `TEST_BYPASS_AUTH=true` (bypass auth; inject super_admin)
    - `TEST_DISABLE_RATE_LIMIT=true` (skip throttling)
    - `DISABLE_REDIS=true`

- Mocked Integration (fast)
  - Scope: route/controller wiring using per‑suite module mocks (no DB).
  - Commands:
    - `cd backend && npm run test:integration`
  - Use this for API shape/response wiring without infra.

- DB‑Backed Integration (slower)
  - Scope: real Postgres; migrations/seeds; smoke flows.
  - Start DB locally:
    - `docker compose -f docker-compose.test.yml up -d db-test`
  - Run tests:
    - `cd backend && npm run test:integration:db`
  - Config:
    - `TEST_DATABASE_URL` (default: `postgresql://booster_user:booster_test_password@localhost:5435/boosterbeacon_test`)
  - Current coverage: `tests/integration/db-*.test.ts`, `tests/integration/migration.test.ts`.
  - Expand coverage by adding new files and updating `backend/jest.integration.db.config.js`.

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml` with 3 jobs:

- Unit + Mocked Integration
  - Installs deps, runs unit + mocked integration with bypass flags.
- DB‑Backed Integration (docker compose)
  - Starts Postgres via `docker-compose.test.yml`, waits for health, runs DB-backed tests.
- DB‑Backed Integration (Actions service)
  - Uses Actions’ `services.postgres` instead of docker compose; same DB URL.

## Local CI Runner

- Root script: `npm run ci:local`
  - Runs unit, mocked integration, spins Postgres test DB, runs DB-backed smoke, tears down DB.

## Conventions

- Keep unit tests fast and deterministic; avoid deep module graphs.
- Move CRUD/route tests to mocked integration with per‑suite mocks.
- Add full flows gradually to DB‑backed lane; ensure migrations/seeds and test DB health are stable.
- Use environment flags to control behavior in tests without touching production code paths.

