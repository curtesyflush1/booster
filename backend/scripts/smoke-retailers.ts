#!/usr/bin/env ts-node
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from backend/.env then project root .env
const candidates = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', '.env')
];
for (const p of candidates) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
}

import { RetailerIntegrationService } from '../src/services/RetailerIntegrationService';

type Args = {
  query?: string;
  retailers?: string;
  limit?: string;
  availability?: string; // pass --availability to include availability phase
  delayMs?: string; // optional delay before availability
};

function parseArgs(): Args {
  const out: Record<string, string> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      out[key] = val;
    }
  }
  return out as Args;
}

function pick<T>(arr: T[], n?: number): T[] {
  if (!n || n <= 0) return arr;
  return arr.slice(0, n);
}

function fmtMs(ms: number) {
  return `${ms.toFixed(0)}ms`;
}

(async () => {
  const startAll = Date.now();
  const args = parseArgs();
  const query = args.query || 'pokemon tcg';
  const retailerCsv = args.retailers || 'target,amazon,walgreens,barnes-noble';
  const limit = args.limit ? Number(args.limit) : undefined;
  const includeAvailability = args.availability === 'true' || args.availability === '' || args.availability === '1';
  const delayMs = args.delayMs ? Number(args.delayMs) : 65000; // default 65s to clear 1m window

  console.log('Retailer smoke starting...');
  console.log('Query:', query);
  console.log('Retailers:', retailerCsv);

  const svc = new RetailerIntegrationService();

  // Resolve target retailers from configs to ensure valid IDs
  const cfgs = svc.getAllRetailerConfigs();
  const requested = retailerCsv.split(',').map(s => s.trim()).filter(Boolean);
  const targetIds = cfgs
    .filter(c => c.isActive)
    .filter(c => requested.includes(c.id) || requested.includes(c.slug))
    .map(c => c.id);

  if (targetIds.length === 0) {
    console.warn('No active matching retailers found for:', requested.join(', '));
    console.warn('Active retailer IDs:', cfgs.filter(c => c.isActive).map(c => c.id).join(', ') || '(none)');
    process.exit(1);
  }

  console.log('Target retailer IDs:', targetIds.join(', '));

  // 1) Health check
  console.log('\n— Health Status —');
  const health = await svc.getRetailerHealthStatus();
  for (const h of health.filter(h => targetIds.includes(h.retailerId))) {
    console.log(`  ${h.retailerId}: ${h.isHealthy ? 'healthy' : 'unhealthy'}, response=${fmtMs(h.responseTime)}, success=${h.successRate.toFixed(1)}%, state=${h.circuitBreakerState}${h.errors.length ? `, errors=${h.errors.join('; ')}` : ''}`);
  }

  // 2) Search products
  console.log('\n— Search —');
  const t0 = Date.now();
  const results = await svc.searchProducts(query, targetIds);
  const byRetailer: Record<string, typeof results> = {};
  for (const r of results) {
    if (!byRetailer[r.retailerId]) byRetailer[r.retailerId] = [];
    byRetailer[r.retailerId]!.push(r);
  }
  for (const id of targetIds) {
    const list = byRetailer[id] || [];
    const sample = pick(list, 2);
    console.log(`  ${id}: ${list.length} results`);
    for (const item of sample) {
      console.log(`    • ${item.metadata?.name || item.productId} | $${item.price ?? '-'} | ${item.availabilityStatus} | ${item.productUrl}`);
    }
  }
  console.log(`Search done in ${fmtMs(Date.now() - t0)}`);

  // 3) Availability check (optional). Health + search already consume 2 requests for scraping retailers.
  if (includeAvailability) {
    console.log(`\nWaiting ${Math.round(delayMs/1000)}s to respect per-minute rate limits...`);
    await new Promise(r => setTimeout(r, delayMs));
    console.log('\n— Availability —');
    const a0 = Date.now();
    const availability = await svc.checkProductAvailability({ productId: query }, targetIds);
    for (const a of availability) {
      console.log(`  ${a.retailerId}: ${a.inStock ? 'in stock' : 'out'} | $${a.price ?? '-'} | ${a.availabilityStatus} | ${a.productUrl}`);
    }
    console.log(`Availability done in ${fmtMs(Date.now() - a0)}`);
  } else {
    console.log('\n— Availability —');
    console.log('  Skipped (pass --availability to include; script will pace to avoid rate limits)');
  }

  // 4) Metrics snapshot
  console.log('\n— Metrics —');
  const metrics = svc.getRetailerMetrics().filter(m => targetIds.includes(m.retailerId));
  for (const m of metrics) {
    console.log(`  ${m.retailerId}: total=${m.totalRequests}, success=${m.successfulRequests}, fail=${m.failedRequests}, avg=${fmtMs(m.averageResponseTime)}, rateLimitHits=${m.rateLimitHits}, cbTrips=${m.circuitBreakerTrips}`);
  }

  console.log(`\nSmoke complete in ${((Date.now() - startAll) / 1000).toFixed(1)}s`);
  process.exit(0);
})().catch((err) => {
  console.error('Smoke failed:', err?.message || err);
  process.exit(1);
});
