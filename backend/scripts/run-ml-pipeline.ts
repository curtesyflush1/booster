#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

function round(n: number, d: number = 4) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

async function main() {
  try {
    // Load env: prefer backend/.env, fallback to project-root/.env
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '..', '.env')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
    }

    const { MLTrainingETLService } = await import('../src/services/ml/MLTrainingETLService');
    const { PricePredictionModelRunner } = await import('../src/services/ml/PricePredictionModelRunner');

    const outDir = path.join(process.cwd(), 'data', 'ml');
    const csvPath = await MLTrainingETLService.run(outDir);

    const text = fs.readFileSync(csvPath, 'utf8').trim();
    const lines = text.split(/\r?\n/);
    const rowCount = Math.max(0, lines.length - 1);

    const runner = new PricePredictionModelRunner();
    await runner.train(csvPath);

    // Load trained model
    const modelPath = path.join(outDir, 'price_model.json');
    const model = JSON.parse(fs.readFileSync(modelPath, 'utf8')) as { coef: number[]; features: string[]; trainedAt: string };

    // Build X and y from CSV to estimate R^2 on training set
    const header = lines[0].split(',');
    const idx = (name: string) => header.indexOf(name);
    const iRecent = idx('recent_avg');
    const iPrev = idx('prev_avg');
    const iTrend = idx('trend_pct');
    const iMsrp = idx('msrp');
    const iPop = idx('popularity');
    const iLabel = idx('label_next7');
    if ([iRecent, iPrev, iTrend, iMsrp, iPop, iLabel].some(n => n < 0)) {
      throw new Error('Invalid header in training CSV');
    }

    const y: number[] = [];
    const yhat: number[] = [];
    for (let k = 1; k < lines.length; k++) {
      const parts = lines[k].split(',');
      if (parts.length !== header.length) continue;
      const recent = Number(parts[iRecent]) || 0;
      const prev = Number(parts[iPrev]) || 0;
      const trend = Number(parts[iTrend]) || 0;
      const msrp = Number(parts[iMsrp]) || 0;
      const pop = Number(parts[iPop]) || 0;
      const label = Number(parts[iLabel]) || 0;
      const popNorm = pop / 1000;
      const x = [1, recent, prev, trend, msrp, popNorm];
      const pred = model.coef.reduce((s, v, i) => s + v * (x[i] || 0), 0);
      y.push(label);
      yhat.push(pred);
    }

    const ybar = y.length ? y.reduce((a, b) => a + b, 0) / y.length : 0;
    const rss = y.reduce((s, v, i) => s + Math.pow(v - yhat[i], 2), 0);
    const tss = y.reduce((s, v) => s + Math.pow(v - ybar, 2), 0);
    const r2 = tss > 0 ? 1 - rss / tss : 1; // degenerate case: all equal labels

    // Log metrics
    // eslint-disable-next-line no-console
    console.log('\nML Pipeline Summary');
    // eslint-disable-next-line no-console
    console.log('===================');
    // eslint-disable-next-line no-console
    console.log('CSV Path       :', csvPath);
    // eslint-disable-next-line no-console
    console.log('Rows Generated :', rowCount);
    // eslint-disable-next-line no-console
    console.log('Model Trained  :', model.trainedAt);
    // eslint-disable-next-line no-console
    console.log('Coef (first 3) :', model.coef.slice(0, 3).map(c => round(c, 6)));
    // eslint-disable-next-line no-console
    console.log('R^2 (train)    :', round(r2, 6));

    process.exit(0);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('ML pipeline failed:', e?.message || e);
    process.exit(1);
  }
}

main();
