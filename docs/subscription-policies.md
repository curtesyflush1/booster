# Subscription Policies

This document explains how subscription plan policies are defined and enforced across the backend.

## Overview

- Single source of truth lives in `backend/src/services/subscriptionService.ts` via:
  - `PLAN_POLICIES`: Map of plan slug → policy
  - `STRIPE_PRICE_ID_TO_PLAN_SLUG`: Env-driven mapping of Stripe Price IDs → plan slugs
  - Helpers:
    - `getPlanSlugForPriceId(priceId?)`
    - `getPlanPolicyForSlug(slug?)`
    - `getUserPlanPolicy(user)`
    - `TOP_TIER_PLAN_SLUGS`

Policy fields:
- `mlEnabled`: Whether ML endpoints/features are allowed
- `historyDays`: Max price-history window (days). `-1` means unlimited (internally capped for safety)
- `channels`: Access to premium channels `{ sms, discord }`

## Watch Limits

Active watch limits are enforced per plan as part of subscription policy:

- Free: 2 active watches
- Pro (monthly/yearly): 10 active watches
- Premium (and Pro+): Unlimited active watches

Enforcement point: `WatchController.createWatch` calls `SubscriptionService.checkQuota(userId, 'watch_created')`, which counts the user's active watches and compares against the plan limit. The same quota is exposed via `/api/subscription/status` and `/api/subscription/usage` for UI.

## Environment Variables

Set the following in `.env` (or production secrets) to map Stripe prices → plan slugs:
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_PRO_PLUS_PRICE_ID` (optional)

Example entries are provided in `.env.example`.

## Enforcement Points

- Price History: `backend/src/controllers/productController.ts:getProductPriceHistory`
  - Uses `getUserPlanPolicy(user)` to cap requested `days` by `policy.historyDays`.

- ML Endpoints: `backend/src/routes/mlRoutes.ts`
  - Gates with `requirePlan(TOP_TIER_PLAN_SLUGS)` for top-tier access.

- Alert Channels: `backend/src/services/alertDeliveryService.ts`
  - Filters `sms`/`discord` via `getUserPlanPolicy(user).channels`
  - Reorders channel preference based on plan class

## Adding a New Plan

1. Add a new entry to `PLAN_POLICIES` with the desired settings.
2. (If using Stripe) add the price ID → slug mapping in `STRIPE_PRICE_ID_TO_PLAN_SLUG` via env.
3. If it should be top-tier (full ML + unlimited history), include its slug in `TOP_TIER_PLAN_SLUGS`.
4. Update pricing docs/UI as needed.

## Example Usage

```ts
import { getUserPlanPolicy } from '../services/subscriptionService';

function canUsePremiumChannel(user: { subscription_plan_id?: string; subscription_tier?: string }) {
  const policy = getUserPlanPolicy(user);
  return policy.channels.sms || policy.channels.discord;
}
```

This centralization ensures consistency and easy future changes without hunting logic across the codebase.
