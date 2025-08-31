# Verifying Alerts Locally

This guide helps you quickly seed a few alerts and verify the Alerts page (Inbox, actions, and analytics) in development.

## Prerequisites

- Dev stack is running: `docker compose -f docker-compose.dev.yml up -d`
- Database is migrated and seeded (products/retailers exist). If needed:
  - `docker compose -f docker-compose.dev.yml exec api npm run migrate:up`
  - `docker compose -f docker-compose.dev.yml exec api npm run seed:dev`

## Generate Test Alerts

The generator creates three alerts (restock, price_drop, low_stock) for a user and an existing product/retailer.

Default (first user — typically the admin seed):

```
docker compose -f docker-compose.dev.yml exec api npm run alerts
```

Target a specific user by email:

```
docker compose -f docker-compose.dev.yml exec -e ALERTS_USER_EMAIL=user@example.com api npm run alerts
# Or with a CLI arg:
docker compose -f docker-compose.dev.yml exec api npm run alerts -- --email=user@example.com
```

## Verify in the UI

1. Open the Alerts page.
2. You should see the generated alerts. Try:
   - Mark as Read (single and bulk)
   - Delete
   - Refresh to confirm changes persist

## Inspecting Which User Was Targeted

The generator targets (in order of precedence):

1. `--email=<address>` CLI argument
2. `ALERTS_USER_EMAIL` environment variable
3. First user in the `users` table (by `created_at` asc) — usually `admin@boosterbeacon.com`

To list users quickly:

```
docker compose -f docker-compose.dev.yml exec postgres psql \
  -U booster_user -d boosterbeacon_dev -c \
  "SELECT id, email, created_at FROM users ORDER BY created_at ASC LIMIT 10;"
```

## Notes

- Rate limiting is disabled in dev (`DISABLE_RATE_LIMITING=true` in compose) to streamline testing.
- The Alerts page uses optimistic UI updates; use Refresh to re-fetch from the server if needed.

