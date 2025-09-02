#!/usr/bin/env ts-node
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

(async () => {
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
    const out = await MLTrainingETLService.run(path.join(process.cwd(), 'data', 'ml'));
    // eslint-disable-next-line no-console
    console.log('ETL complete:', out);
    process.exit(0);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('ETL failed:', e?.message || e);
    process.exit(1);
  }
})();
