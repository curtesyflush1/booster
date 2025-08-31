# ML Model Runner Architecture (Phase 4)

This document describes the pluggable ML model runner used to power predictive insights on the Dashboard.

## Overview

- Goals:
  - Return realistic, deterministic insights quickly (Heuristic model)
  - Keep architecture flexible to replace with trained models later (batch scoring)
- Entry points:
  - `DashboardService.generateProductInsights(productId)` → delegates to model runner
  - `ModelFactory.getActiveRunner()` provides the current runner

## Files

- `backend/src/services/ml/IModelRunner.ts`
  - Interface with `predict(productId): Promise<ProductInsights | null>`
- `backend/src/services/ml/HeuristicModelRunner.ts`
  - Implements `IModelRunner`
  - Uses:
    - Price history (last 28 points) to compute a 7-day trend vs previous 7-day window
    - Recent alert velocity (last 7 days)
    - Product popularity score
  - Produces:
    - Price forecast (next week / next month) from baseline × trend scale
    - Sellout risk from alert velocity + popularity
    - ROI estimates from trend and discount vs MSRP
    - Hype score from popularity + alert velocity
- `backend/src/services/ml/ModelFactory.ts`
  - Returns a singleton `HeuristicModelRunner` (future: swap to a cached/trained runner)
- `backend/src/services/dashboardService.ts`
  - Replaced ad-hoc mock logic with `ModelFactory.getActiveRunner().predict(productId)`

## Behavior (Heuristic Model)

- Uses deterministic calculations (no randomness) to ensure predictable results
- Confidence bounds derive from history depth and alert velocity
- Falls back to MSRP when price history is sparse

## Roadmap

- Add batch scoring and a cached insights table
- ModelFactory returns a runner that reads cached insights; fallback to heuristic if stale or missing
- Train a real model (ARIMA/XGBoost/etc.) and wrap in a `LearnedModelRunner`

## Local Validation

1. Start the stack:
   - `docker compose -f docker-compose.dev.yml up -d`
2. Seed data (if needed):
   - `docker compose -f docker-compose.dev.yml exec api npm run migrate:up`
   - `docker compose -f docker-compose.dev.yml exec api npm run seed:dev`
3. Generate alerts to enrich signals:
   - `docker compose -f docker-compose.dev.yml exec api npm run alerts`
4. Open Dashboard → Predictive Insights tab
   - Forecast, sellout risk, ROI, hype show trend- and signal-based results

## Pushing Memories

- Bundle: `docs/memory/booster-beacon-memories.json`
- Push via REST:
  - `export OPENMEMORY_API_KEY="<key>"`
  - `curl -sS -X POST "https://api.openmemory.dev/projects/booster-beacon-proj-001/memories" \
     -H "Authorization: Bearer $OPENMEMORY_API_KEY" \
     -H "Content-Type: application/json" \
     --data-binary @docs/memory/booster-beacon-memories.json`

