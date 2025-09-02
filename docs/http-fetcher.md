# HTTP Fetcher Provider Integration (In‑House Unlocker)

This document describes how outbound HTTP requests (e.g., retailer pages and APIs) are performed with provider-based resilience against anti-bot measures.

## Overview

- Entry point: `backend/src/services/HttpFetcherService.ts`
- Providers:
  - `direct` (default): simple `axios.get`
  - `proxy`: In-house unlocker/proxy gateway
  - `browser`: Remote browser API (placeholder)

The `BaseRetailerService` uses `HttpFetcherService` for all external requests, enabling central configuration and fallback behavior.

## Configuration

Set the provider and (optionally) the Bright Data settings in environment variables.

```
# Provider selection
HTTP_FETCH_PROVIDER=direct   # or 'proxy' | 'browser'

# In-house Unlocker / Proxy Gateway
UNLOCKER_API_URL=https://unlocker.internal/api/unblock
UNLOCKER_API_TOKEN=sk_replace_me
UNLOCKER_COUNTRY=us
UNLOCKER_MAX_RETRIES=2
UNLOCKER_SESSION_TTL_MS=120000
UNLOCKER_TIMEOUT_MS=30000
```

See `backend/.env.example` for example values. In production, set the provider to `proxy` and configure your internal gateway credentials.

## Behavior

- For `proxy`:
  - Sends a POST request to the unlocker endpoint with payload:
    - `url`, `method`, `params`, `render`, `country`, `session`, and minimal headers
  - Maintains a sticky session ID for `BRIGHTDATA_SESSION_TTL_MS` to improve success rates
  - Retries on `403`, `429`, or timeouts up to `BRIGHTDATA_MAX_RETRIES` with exponential backoff
  - Fallbacks to `direct` provider on final failure
  - Extracts response content from common fields: `content`, `solution.content`, `response.body`, or raw `data`

Back-compat: existing deployments using BRIGHTDATA_* env vars remain supported but are deprecated.

- For `browser`:
  - Placeholder for a remote browser API (e.g., Browserless/Zyte). Configure `BROWSER_API_URL` and `BROWSER_API_TOKEN` to enable.

## Usage

Retailer services call:

```
const res = await this.httpFetcher.get(fullUrl, {
  params,
  headers,
  timeout: this.config.timeout,
  render: options.render === true,
});
```

Switching providers requires no code changes to individual retailers—set environment variables and redeploy.

## Notes

- Keep usage within provider terms of service.
- Monitor success rates in retailer health checks; aggressive sites may require `render: true` and appropriate headers.
