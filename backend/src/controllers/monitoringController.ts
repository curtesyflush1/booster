import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoringService';
import { loggerWithContext } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { DASHBOARD_TIME_WINDOWS, TIME_UNITS } from '../constants';

/**
 * Get system metrics
 * GET /api/monitoring/metrics
 */
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { metric, startTime, endTime, aggregation } = req.query;
    
    loggerWithContext.info('Retrieving metrics', {
      metric,
      startTime,
      endTime,
      aggregation,
      correlationId: req.correlationId
    });

    if (metric && typeof metric === 'string') {
      // Get specific metric
      const start = startTime ? new Date(startTime as string) : undefined;
      const end = endTime ? new Date(endTime as string) : undefined;
      
      if (aggregation === 'stats') {
        const stats = monitoringService.getMetricStats(metric, start, end);
        successResponse(res, { metric, stats }, 'Metric statistics retrieved successfully');
      } else {
        const data = monitoringService.getMetrics(metric, start, end);
        successResponse(res, { metric, data }, 'Metric data retrieved successfully');
      }
    } else {
      // Get all available metrics (last hour by default)
      const end = new Date();
      const start = new Date(end.getTime() - DASHBOARD_TIME_WINDOWS.DEFAULT_MONITORING_WINDOW);
      
      const availableMetrics = [
        'memory_usage_percent',
        'cpu_usage_percent',
        'avg_response_time_ms',
        'error_rate_percent',
        'database_health',
        'redis_health',
        'uptime_seconds'
      ];
      
      const metricsData = availableMetrics.reduce((acc, metricName) => {
        acc[metricName] = monitoringService.getMetricStats(metricName, start, end);
        return acc;
      }, {} as Record<string, any>);
      
      successResponse(res, metricsData, 'All metrics retrieved successfully');
    }
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve metrics', error as Error);
    errorResponse(res, 500, 'Failed to retrieve metrics');
  }
};

/**
 * Record a custom metric
 * POST /api/monitoring/metrics
 */
export const recordMetric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { metric, value, labels } = req.body;
    
    if (!metric || typeof metric !== 'string') {
      errorResponse(res, 400, 'Metric name is required');
      return;
    }
    
    if (typeof value !== 'number') {
      errorResponse(res, 400, 'Metric value must be a number');
      return;
    }
    
    monitoringService.recordMetric(metric, value, labels);
    
    loggerWithContext.info('Custom metric recorded', {
      metric,
      value,
      labels,
      correlationId: req.correlationId
    });
    
    successResponse(res, { metric, value, labels }, 'Metric recorded successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to record metric', error as Error);
    errorResponse(res, 500, 'Failed to record metric');
  }
};

/**
 * Get alert rules
 * GET /api/monitoring/alerts/rules
 */
export const getAlertRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = monitoringService.getAlertRules();
    
    successResponse(res, rules, 'Alert rules retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve alert rules', error as Error);
    errorResponse(res, 500, 'Failed to retrieve alert rules');
  }
};

/**
 * Create or update alert rule
 * POST /api/monitoring/alerts/rules
 */
export const createAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = req.body;
    
    monitoringService.addAlertRule(rule);
    
    loggerWithContext.audit('alert_rule_created', req.user?.id, {
      ruleId: rule.id,
      ruleName: rule.name,
      correlationId: req.correlationId
    });
    
    successResponse(res, rule, 'Alert rule created successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to create alert rule', error as Error);
    errorResponse(res, 500, 'Failed to create alert rule');
  }
};

/**
 * Delete alert rule
 * DELETE /api/monitoring/alerts/rules/:ruleId
 */
export const deleteAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;
    
    if (!ruleId) {
      errorResponse(res, 400, 'Rule ID is required');
      return;
    }
    
    monitoringService.removeAlertRule(ruleId);
    
    loggerWithContext.audit('alert_rule_deleted', req.user?.id, {
      ruleId,
      correlationId: req.correlationId
    });
    
    successResponse(res, null, 'Alert rule deleted successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to delete alert rule', error as Error);
    errorResponse(res, 500, 'Failed to delete alert rule');
  }
};

/**
 * Get active alerts
 * GET /api/monitoring/alerts/active
 */
export const getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = monitoringService.getActiveAlerts();
    
    successResponse(res, alerts, 'Active alerts retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve active alerts', error as Error);
    errorResponse(res, 500, 'Failed to retrieve active alerts');
  }
};

/**
 * Get alert history
 * GET /api/monitoring/alerts/history
 */
export const getAlertHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 100;
    
    const history = monitoringService.getAlertHistory(limitNum);
    
    successResponse(res, history, 'Alert history retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve alert history', error as Error);
    errorResponse(res, 500, 'Failed to retrieve alert history');
  }
};

/**
 * Get monitoring dashboard data
 * GET /api/monitoring/dashboard
 */
export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeRange } = req.query;
    const hours = timeRange ? parseInt(timeRange as string) : 24;
    
    const end = new Date();
    const start = new Date(end.getTime() - hours * TIME_UNITS.HOUR);
    
    // Get key metrics
    const metrics = {
      memory: monitoringService.getMetricStats('memory_usage_percent', start, end),
      cpu: monitoringService.getMetricStats('cpu_usage_percent', start, end),
      responseTime: monitoringService.getMetricStats('avg_response_time_ms', start, end),
      errorRate: monitoringService.getMetricStats('error_rate_percent', start, end),
      uptime: monitoringService.getMetricStats('uptime_seconds', start, end)
    };
    
    // Get alerts
    const activeAlerts = monitoringService.getActiveAlerts();
    const alertHistory = monitoringService.getAlertHistory(50);
    
    // Get recent metric data for charts
    const chartData = {
      memory: monitoringService.getMetrics('memory_usage_percent', start, end),
      cpu: monitoringService.getMetrics('cpu_usage_percent', start, end),
      responseTime: monitoringService.getMetrics('avg_response_time_ms', start, end),
      errorRate: monitoringService.getMetrics('error_rate_percent', start, end)
    };
    
    const dashboardData = {
      timeRange: { start, end, hours },
      metrics,
      alerts: {
        active: activeAlerts,
        history: alertHistory,
        summary: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          high: activeAlerts.filter(a => a.severity === 'high').length,
          medium: activeAlerts.filter(a => a.severity === 'medium').length,
          low: activeAlerts.filter(a => a.severity === 'low').length
        }
      },
      charts: chartData
    };
    
    successResponse(res, dashboardData, 'Dashboard data retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve dashboard data', error as Error);
    errorResponse(res, 500, 'Failed to retrieve dashboard data');
  }
};

// --- Drop/URL Candidates metrics (admin) ---
import { BaseModel } from '../models/BaseModel';
import { redisService } from '../services/redisService';
import { UrlCandidateMetricsService } from '../services/urlCandidateMetricsService';
import { transactionService } from '../services/transactionService';
import { redisService } from '../services/redisService';

export const getDropMetrics = async (_req: Request, res: Response): Promise<void> => {
  const db = BaseModel.getKnex();
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    // url_candidates by status
    const uc = await db('url_candidates')
      .select('status')
      .count('* as count')
      .groupBy('status');

    // drop_events by type (24h / 7d)
    const ev24 = await db('drop_events')
      .select('signal_type')
      .count('* as count')
      .where('observed_at', '>=', last24h)
      .groupBy('signal_type');
    const ev7 = await db('drop_events')
      .select('signal_type')
      .count('* as count')
      .where('observed_at', '>=', last7d)
      .groupBy('signal_type');

    // lead-time basic: first_instock_at - first_seen_at (last 7d)
    const outcomes = await db('drop_outcomes')
      .select('product_id','retailer_id','first_seen_at','first_instock_at')
      .where('drop_at','>=', last7d);
    const leadTimes = outcomes
      .map(o => (!o.first_seen_at || !o.first_instock_at) ? null : ((new Date(o.first_instock_at).getTime() - new Date(o.first_seen_at).getTime())/1000))
      .filter((n): n is number => typeof n === 'number' && isFinite(n) && n>=0)
      .sort((a,b)=>a-b);
    const p = (arr:number[], q:number)=> arr.length? arr[Math.floor(q*(arr.length-1))]: null;

    const summary = {
      urlCandidates: uc.reduce((acc:any,r:any)=>{acc[r.status]=Number(r.count);return acc;},{}),
      events24h: ev24.reduce((acc:any,r:any)=>{acc[r.signal_type]=Number(r.count);return acc;},{}),
      events7d: ev7.reduce((acc:any,r:any)=>{acc[r.signal_type]=Number(r.count);return acc;},{}),
      leadTimeSec: {
        p50: p(leadTimes,0.5), p90: p(leadTimes,0.9), p95: p(leadTimes,0.95), n: leadTimes.length
      }
    };

    successResponse(res, summary, 'Drop metrics');
  } catch (error) {
    errorResponse(res, 500, 'Failed to compute drop metrics');
  }
};

export const getDropBudgets = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Read known retailer slugs and budgets
    const db = BaseModel.getKnex();
    const rows: Array<{ slug: string }> = await db('retailers').select('slug');
    const entries: Array<{ slug: string; qpm: number; source: 'redis' | 'env' | 'default'; key: string; limiter?: { count: number; ttl: number } }>= [];
    for (const r of rows) {
      const slug = r.slug;
      const redisKey = `config:url_candidate:qpm:${slug}`;
      let qpm = 6; let source: 'redis'|'env'|'default' = 'default';
      const val = await redisService.get(redisKey);
      if (val) { qpm = Number(val) || 6; source = 'redis'; }
      else {
        const envKey = `URL_CANDIDATE_QPM_${slug.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`;
        if (process.env[envKey]) { qpm = Number(process.env[envKey]) || 6; source = 'env'; }
        else if (process.env.URL_CANDIDATE_QPM_DEFAULT) { qpm = Number(process.env.URL_CANDIDATE_QPM_DEFAULT) || 6; source = 'env'; }
      }
      // Limiter status
      const limiterKey = `candqpm:${slug}`;
      let limiter: { count: number; ttl: number } | undefined;
      try { limiter = await redisService.getRateLimitStatus(limiterKey); } catch {}
      entries.push({ slug, qpm, source, key: redisKey, limiter });
    }
    successResponse(res, { budgets: entries }, 'Drop budgets');
  } catch (error) {
    errorResponse(res, 500, 'Failed to get drop budgets');
  }
};

export const setDropBudgets = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body?.budgets as Array<{ slug: string; qpm: number }> | undefined;
    if (!Array.isArray(updates) || updates.length === 0) {
      errorResponse(res, 400, 'budgets array required');
      return;
    }
    for (const u of updates) {
      if (!u.slug || typeof u.qpm !== 'number' || u.qpm <= 0) continue;
      const key = `config:url_candidate:qpm:${u.slug}`;
      await redisService.set(key, String(Math.floor(u.qpm)), 0);
    }
    successResponse(res, { updated: updates.length }, 'Budgets updated');
  } catch (error) {
    errorResponse(res, 500, 'Failed to set drop budgets');
  }
};

export const getDropClassifierStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(process.cwd(),'data','ml','drop_classifier_calibration.json');
    if (!fs.existsSync(p)) {
      successResponse(res, { exists: false }, 'No classifier calibration found');
      return;
    }
    const j = JSON.parse(fs.readFileSync(p,'utf8'));
    successResponse(res, { exists: true, ...j }, 'Classifier status');
  } catch (error) {
    errorResponse(res, 500, 'Failed to get classifier status');
  }
};

export const getDropClassifierFlags = async (_req: Request, res: Response): Promise<void> => {
  try {
    const primary = (await redisService.get('config:drop_classifier:primary_enabled')) === 'true';
    const threshold = Number((await redisService.get('config:drop_classifier:threshold')) || '0.5');
    successResponse(res, { primaryEnabled: primary, threshold }, 'Classifier flags');
  } catch (error) {
    errorResponse(res, 500, 'Failed to get classifier flags');
  }
};

export const setDropClassifierFlags = async (req: Request, res: Response): Promise<void> => {
  try {
    const primary = !!req.body?.primaryEnabled;
    const threshold = Number(req.body?.threshold || 0.5);
    await redisService.set('config:drop_classifier:primary_enabled', primary ? 'true' : 'false');
    await redisService.set('config:drop_classifier:threshold', String(Math.max(0, Math.min(1, threshold))));
    successResponse(res, { primaryEnabled: primary, threshold }, 'Classifier flags updated');
  } catch (error) {
    errorResponse(res, 500, 'Failed to set classifier flags');
  }
};

export const getDropTimeSeries = async (req: Request, res: Response): Promise<void> => {
  try {
    const minutes = Math.max(5, Math.min(parseInt(String(req.query.minutes || '60'), 10) || 60, 180));
    const slugsParam = String(req.query.slugs || '');
    let slugs: string[] = [];
    if (slugsParam) slugs = slugsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      const rows: Array<{ slug: string }> = await BaseModel.getKnex()('retailers').select('slug');
      slugs = rows.map(r => r.slug);
    }
    const series = await UrlCandidateMetricsService.getSeries(slugs, minutes, ['requests','blocked','errors']);
    successResponse(res, series, 'Drop time series');
  } catch (error) {
    errorResponse(res, 500, 'Failed to get drop time series');
  }
};

export const getDropLiveSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = BaseModel.getKnex();
    const now = new Date();
    const last24 = new Date(now.getTime() - 24*60*60*1000);
    const rows = await db('drop_events')
      .select(db.raw("date_trunc('hour', observed_at) as hour"), 'signal_type')
      .count('* as count')
      .where('observed_at','>=', last24)
      .whereIn('signal_type', ['url_live','in_stock'])
      .groupBy(db.raw("date_trunc('hour', observed_at)"), 'signal_type')
      .orderBy('hour','asc');
    const map: Record<string, { url_live: number; in_stock: number }> = {};
    rows.forEach((r: any) => {
      const hour = new Date(r.hour).toISOString();
      if (!map[hour]) map[hour] = { url_live: 0, in_stock: 0 };
      map[hour][r.signal_type] = Number(r.count || 0);
    });
    const hours = Object.keys(map).sort();
    const urlLive = hours.map(h => map[h].url_live);
    const inStock = hours.map(h => map[h].in_stock);
    const total = urlLive.reduce((a,b)=>a+b,0) + inStock.reduce((a,b)=>a+b,0);
    successResponse(res, { hours, urlLive, inStock, total }, 'Live promotions summary');
  } catch (error) {
    errorResponse(res, 500, 'Failed to get live summary');
  }
};

// ---- On-demand admin operations ----
import { DropClassifierTrainerService } from '../services/ml/DropClassifierTrainerService';
import { URLCandidateChecker } from '../services/URLCandidateChecker';

export const trainDropClassifierNow = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      lookbackDays = 30,
      horizonMinutes = 60,
      historyWindowDays = 7,
      sampleStepMinutes = 60,
      maxSamples = 3000
    } = req.body || {};
    const result = await DropClassifierTrainerService.train({
      lookbackDays: Number(lookbackDays),
      horizonMinutes: Number(horizonMinutes),
      historyWindowDays: Number(historyWindowDays),
      sampleStepMinutes: Number(sampleStepMinutes),
      maxSamples: Number(maxSamples)
    });
    successResponse(res, result, 'Drop classifier training triggered');
  } catch (error) {
    errorResponse(res, 500, 'Failed to train drop classifier');
  }
};

export const runUrlCandidateCheckBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 10, timeout = 8000, provider, render = true } = req.body || {};
    if (provider) process.env.HTTP_FETCH_PROVIDER = String(provider);
    process.env.URL_CANDIDATE_TIMEOUT_MS = String(timeout);
    if (render) process.env.URL_CANDIDATE_FORCE_RENDER = 'true';
    try { await redisService.connect(); } catch {}
    const out = await URLCandidateChecker.checkBatch(Math.min(Number(limit) || 10, 50));
    try { await redisService.disconnect(); } catch {}
    successResponse(res, out, 'URL candidate check batch complete');
  } catch (error) {
    errorResponse(res, 500, 'Failed to run candidate checker');
  }
};

export const runSmokeTests = async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = BaseModel.getKnex();
    const tests: Array<{ name: string; ok: boolean; details?: any }> = [];
    try { await db.raw('SELECT 1'); tests.push({ name: 'db_connect', ok: true }); } catch (e:any) { tests.push({ name: 'db_connect', ok: false, details: e?.message }); }
    try { const ping = await redisService.ping(); tests.push({ name: 'redis_ping', ok: ping === 'PONG' }); } catch (e:any) { tests.push({ name: 'redis_ping', ok: false, details: e?.message }); }
    try { const health = await db('retailers').count('* as c').first(); tests.push({ name: 'retailers_table', ok: true, details: health }); } catch (e:any) { tests.push({ name: 'retailers_table', ok: false, details: e?.message }); }
    const ok = tests.every(t => t.ok);
    successResponse(res, { ok, tests }, 'Smoke tests complete');
  } catch (error) {
    errorResponse(res, 500, 'Smoke tests failed');
  }
};
// remove duplicate export (not needed)

// ---------------- Purchase Metrics + Precision ----------------

export const getPurchaseMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = BaseModel.getKnex();
    const windowHours = Math.max(1, Math.min(parseInt(String(req.query.windowHours || '24'), 10) || 24, 720));
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const rows = await db('transactions')
      .select('retailer_slug', 'status', 'lead_time_ms')
      .where('created_at', '>=', since);

    const byRetailer: Record<string, { attempts: number; purchased: number; leadTimes: number[] }> = {};
    for (const r of rows) {
      const slug = r.retailer_slug || 'unknown';
      if (!byRetailer[slug]) byRetailer[slug] = { attempts: 0, purchased: 0, leadTimes: [] };
      if (['attempted', 'failed', 'purchased'].includes(r.status)) byRetailer[slug].attempts++;
      if (r.status === 'purchased') {
        byRetailer[slug].purchased++;
        const lt = r.lead_time_ms ? Number(r.lead_time_ms) : null;
        if (typeof lt === 'number' && isFinite(lt) && lt >= 0) byRetailer[slug].leadTimes.push(lt);
      }
    }
    const pct = (a: number[]) => (q: number) => {
      if (!a.length) return null;
      const sorted = [...a].sort((x,y)=>x-y);
      const idx = Math.floor(q * (sorted.length - 1));
      return sorted[idx];
    };
    const out = Object.keys(byRetailer).map(slug => {
      const s = byRetailer[slug];
      const p = pct(s.leadTimes);
      return {
        retailer: slug,
        attempts: s.attempts,
        purchased: s.purchased,
        purchase_rate: s.attempts ? s.purchased / s.attempts : 0,
        lead_time_ms: {
          p50: p(0.5), p90: p(0.9), p95: p(0.95), count: s.leadTimes.length
        }
      };
    });
    successResponse(res, { windowHours, retailers: out }, 'Purchase metrics');
  } catch (error) {
    errorResponse(res, 500, 'Failed to compute purchase metrics');
  }
};

export const getPrecisionAtK = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = BaseModel.getKnex();
    const k = Math.max(1, Math.min(parseInt(String(req.query.k || '3'), 10) || 3, 10));
    const days = Math.max(1, Math.min(parseInt(String(req.query.days || '7'), 10) || 7, 60));
    const productIdsParam = String(req.query.productIds || '').trim();
    const slugsParam = String(req.query.retailers || '').trim();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Scope products
    let productIds: string[] = [];
    if (productIdsParam) productIds = productIdsParam.split(',').map(s => s.trim()).filter(Boolean);

    // Map retailer slugs -> ids
    let slugFilter: string[] = [];
    if (slugsParam) slugFilter = slugsParam.split(',').map(s => s.trim()).filter(Boolean);
    const retailers = await db('retailers').select('id','slug');
    const idBySlug = new Map<string,string>(retailers.map((r:any)=>[r.slug, r.id] as const));
    const slugById = new Map<string,string>(retailers.map((r:any)=>[r.id, r.slug] as const));
    const retailerIds = slugFilter.length ? slugFilter.map(sl => idBySlug.get(sl)).filter(Boolean) as string[] : retailers.map((r:any)=>r.id);

    // Collect outcomes in window
    let q = db('drop_outcomes')
      .select('id','product_id','retailer_id','first_instock_at')
      .where('drop_at','>=', cutoff)
      .whereIn('retailer_id', retailerIds);
    if (productIds.length) q = q.whereIn('product_id', productIds);
    const outcomes = await q;

    let hits = 0; let total = 0;
    const perRetailer: Record<string, { hits: number; total: number }> = {};
    for (const o of outcomes) {
      const slug = slugById.get(o.retailer_id) || 'unknown';
      if (!perRetailer[slug]) perRetailer[slug] = { hits: 0, total: 0 };
      perRetailer[slug].total++; total++;

      // Top-K candidates by score for this product/retailer
      const cands = await db('url_candidates')
        .select('status','score','last_checked_at')
        .where({ product_id: o.product_id, retailer_id: o.retailer_id })
        .andWhere('score','is not', null)
        .orderBy('score','desc')
        .limit(k);
      if (!cands.length) continue;

      // Simple success condition: any top-K candidate became 'live' before or at first_instock_at (if available), else before drop_at
      const firstIn = o.first_instock_at ? new Date(o.first_instock_at) : null;
      const success = cands.some(c => {
        if (c.status !== 'live') return false;
        const checkedAt = c.last_checked_at ? new Date(c.last_checked_at) : null;
        if (!checkedAt) return true; // if unknown, count as success conservatively
        if (firstIn) return checkedAt.getTime() <= firstIn.getTime();
        return true;
      });
      if (success) { hits++; perRetailer[slug].hits++; }
    }

    const perRetailerOut = Object.keys(perRetailer).map(slug => ({
      retailer: slug,
      total: perRetailer[slug].total,
      hits: perRetailer[slug].hits,
      p_at_k: perRetailer[slug].total ? perRetailer[slug].hits / perRetailer[slug].total : 0
    }));

    successResponse(res, { k, days, total, hits, p_at_k: total ? hits/total : 0, byRetailer: perRetailerOut }, 'Precision@K summary');
  } catch (error) {
    errorResponse(res, 500, 'Failed to compute precision@K');
  }
};

// Retailer crawl config (render behavior, session reuse, burst QPM)
export const getCrawlConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows: Array<{ slug: string }> = await BaseModel.getKnex()('retailers').select('slug');
    const slugs = rows.map(r => r.slug);
    const out: Array<{ slug: string; renderBehavior: string; sessionReuse: boolean; burstQpm?: number | null; qpm?: number | null }>= [];
    for (const slug of slugs) {
      let renderBehavior = 'on_block';
      try {
        const rb = await redisService.get(`config:url_candidate:render_behavior:${slug}`);
        if (rb) renderBehavior = rb;
      } catch {}
      let sessionReuse = true;
      try {
        const sr = await redisService.get(`config:url_candidate:session_reuse:${slug}`);
        if (sr) sessionReuse = !/^false|0|no$/i.test(sr);
      } catch {}
      let burstQpm: number | null = null;
      try {
        const b = await redisService.get(`config:url_candidate:qpm_burst:${slug}`);
        burstQpm = b ? (parseInt(b,10) || null) : null;
      } catch {}
      let qpm: number | null = null;
      try {
        const q = await redisService.get(`config:url_candidate:qpm:${slug}`);
        qpm = q ? (parseInt(q,10) || null) : null;
      } catch {}
      out.push({ slug, renderBehavior, sessionReuse, burstQpm, qpm });
    }
    successResponse(res, { configs: out }, 'Crawl config');
  } catch (error) {
    errorResponse(res, 500, 'Failed to load crawl config');
  }
};

export const setCrawlConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body?.configs as Array<{ slug: string; renderBehavior?: string; sessionReuse?: boolean; burstQpm?: number; qpm?: number }>;
    if (!Array.isArray(updates) || updates.length === 0) {
      errorResponse(res, 400, 'configs array required');
      return;
    }
    for (const u of updates) {
      if (!u.slug) continue;
      if (u.renderBehavior && ['always','on_block','never'].includes(u.renderBehavior)) {
        await redisService.set(`config:url_candidate:render_behavior:${u.slug}`, u.renderBehavior);
      }
      if (typeof u.sessionReuse === 'boolean') {
        await redisService.set(`config:url_candidate:session_reuse:${u.slug}`, u.sessionReuse ? 'true' : 'false');
      }
      if (typeof u.burstQpm === 'number' && u.burstQpm > 0) {
        await redisService.set(`config:url_candidate:qpm_burst:${u.slug}`, String(Math.floor(u.burstQpm)));
      }
      if (typeof u.qpm === 'number' && u.qpm > 0) {
        await redisService.set(`config:url_candidate:qpm:${u.slug}`, String(Math.floor(u.qpm)));
      }
    }
    successResponse(res, { updated: updates.length }, 'Crawl config updated');
  } catch (error) {
    errorResponse(res, 500, 'Failed to set crawl config');
  }
};
