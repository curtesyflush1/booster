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
    - Basic trend summary (`basicTrend`): direction and percent change week-over-week
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

### Response Shape (key fields)

```
{
  productId: string,
  productName: string,
  priceForcast: { nextWeek: number, nextMonth: number, confidence: number },
  basicTrend?: { direction: 'up'|'down'|'flat', percent: number, window?: string },
  selloutRisk: { score: number, timeframe: string, confidence: number },
  roiEstimate: { shortTerm: number, longTerm: number, confidence: number },
  hypeScore: number,
  updatedAt: string
}
```

Notes:
- `basicTrend` explicitly surfaces the week-over-week change the model already computes; this is included for clarity and UI hints. It is optional to preserve backward compatibility.

### Access Tiers

- Pro: Limited ML — `basicTrend` and a weekly forecast are available in payloads (UI may hide the full ML tab for Pro).
- Premium: Full ML — all fields available (forecasts, ROI, sellout risk, hype).

## Roadmap

- Add batch scoring and a cached insights table
- ModelFactory returns a runner that reads cached insights; fallback to heuristic if stale or missing
- Train a real model (ARIMA/XGBoost/etc.) and wrap in a `LearnedModelRunner`

## Admin Endpoints

- GET `/api/admin/ml/models/price/metadata` — returns current runner model metadata (trainedAt, features, coefficients) from `data/ml/price_model.json`.
- POST `/api/admin/ml/models/price/retrain` — triggers ETL + training synchronously and updates `ml_models` with metrics `{ rows, r2 }`.

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

- Preferred: `npm run memories:push`
  - `export OPENMEMORY_API_KEY="<key>"`
  - Optional: `export OPENMEMORY_MEMORIES_URL="https://app.openmemory.dev/memories"`
  - Optional: `export OPENMEMORY_APP_NAME="booster-beacon"`

- Direct REST (single memory example):
  - `curl -sS -X POST "https://app.openmemory.dev/memories" \
     -H "Authorization: Bearer $OPENMEMORY_API_KEY" \
     -H "Content-Type: application/json" \
     --data '{"memory":"Deployed heuristic model runner","categories":["ml","deploy"],"app_name":"booster-beacon","metadata":{"stage":"dev"}}'`
