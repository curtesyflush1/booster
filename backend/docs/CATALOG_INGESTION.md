# Catalog Ingestion Pipeline

Automated pipeline to discover Pokémon TCG products across retailers, normalize them into our catalog, and feed price/availability data into ML and investment tools.

## Overview

- Adapters: Retailer services implement `searchProducts(query)` and `checkAvailability(...)`.
- Ingestion: `CatalogIngestionService.discoverAndIngest()` runs discovery queries (booster boxes, ETBs, packs, tins, etc.), upserts `products`, and upserts `product_availability`.
- Mapping: Maintains `external_product_map` linking retailer slug + external id to our product id for dedupe.
- Scheduling: Cron runs discovery every 3 hours; availability scans run every 5 minutes; data collection (price history, snapshots) runs hourly.

## Data Flow

1. Discovery → `searchProducts(q)` per retailer → candidate items with metadata (name, url, price, upc/sku).
2. Normalize → upsert `products` by `upc` or `slug` (derived from name), inferring category (ETB/Booster/etc.).
3. Availability → upsert into `product_availability` from discovery payload; frequent scans refine state.
4. Price History → hourly job writes current prices from availability into `price_history`.
5. ML/Insights → Heuristic model uses last 28 days of price history, alert velocity, popularity, and user-reported purchase signals.

## Files

- `backend/src/services/catalogIngestionService.ts` — discovery, normalization, upserts, mapping table creation.
- `backend/src/services/RetailerIntegrationService.ts` — retailer configs and adapter orchestration (Best Buy, Walmart, Costco, Sam's Club); accepts `BESTBUY_API_KEY` or `BEST_BUY_API_KEY`.
- `backend/src/services/CronService.ts` — schedules ingestion (`0 */3 * * *`).
 
## Admin Dry-Run Endpoint

- Endpoint: `POST /api/admin/catalog/ingestion/dry-run`
- AuthZ: Requires `product:bulk:import`
- Body (optional): `{ "queries": ["pokemon tcg", "pokemon booster box"] }`
- Response:
  - `discovered`: number of retailer items discovered
  - `toCreateCount`, `toUpdateCount`, `availabilityPreviewCount`
  - `toCreate`: normalized product payloads that would be inserted
  - `toUpdate`: `{ productId, slug, changes: { field: { from, to } } }`
  - `availabilityPreview`: `{ productRef: { id?, slug }, retailer, price?, url, status }`

Use this before enabling new adapters or changing discovery logic to verify the impact without modifying the database.

## Environment

- Best Buy: `BESTBUY_API_KEY` or `BEST_BUY_API_KEY`
- Walmart: `WALMART_API_KEY`

## Extending Retailers

1. Implement `searchProducts(query)` in the retailer service to return Pokémon-only results (use `isPokemonTcgProduct`).
2. Return metadata fields: `name`, `upc` (if available), `image`, `msrp`, and `shortDescription`.
3. Add the new retailer to `RetailerIntegrationService.getRetailerConfigs()` and ensure it’s seeded in `retailers` table.

## Privacy

- Catalog ingestion stores product and pricing data only. No personal user data is collected in this pipeline.
