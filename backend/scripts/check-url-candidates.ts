import 'dotenv/config';
import { URLCandidateChecker } from '../src/services/URLCandidateChecker';
import { BaseModel } from '../src/models/BaseModel';
import { redisService } from '../src/services/redisService';

async function main() {
  const argv = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) { argv.set(key, val); i++; }
      else argv.set(key, 'true');
    }
  }
  const limit = parseInt(argv.get('limit') || '10', 10);
  const timeout = parseInt(argv.get('timeout') || '6000', 10);
  const renderFlag = (argv.get('render') || 'false').toLowerCase() === 'true';
  if (!process.env.URL_CANDIDATE_TIMEOUT_MS) process.env.URL_CANDIDATE_TIMEOUT_MS = String(timeout);
  if (renderFlag) process.env.URL_CANDIDATE_FORCE_RENDER = 'true';
  const knex = BaseModel.getKnex();
  const toCheck = await knex('url_candidates')
    .select('id','url','status','score','updated_at')
    .whereIn('status', ['unknown','valid'])
    .orderBy('updated_at','asc')
    .limit(limit);
  if (!toCheck.length) {
    console.log('No url_candidates with status unknown/valid found. Seed candidates first.');
    return;
  }
  console.log(`Checking ${toCheck.length} candidate(s):`);
  for (const r of toCheck) console.log(` - ${r.id} ${r.status} ${r.score ?? ''} ${r.url}`);
  // Ensure Redis is connected for budgets/metrics (fail open if it errors)
  try { await redisService.connect(); } catch {}
  const out = await URLCandidateChecker.checkBatch(limit);
  try { await redisService.disconnect(); } catch {}
  console.log(`Done. Checked=${out.checked} liveFound=${out.liveFound}`);
  const after = await knex('url_candidates')
    .select('id','status','score','reason','last_checked_at')
    .orderBy('updated_at','desc')
    .limit(Math.min(limit, 10));
  console.log('Latest url_candidates:');
  for (const r of after) console.log(` - ${r.id} ${r.status} ${r.score ?? ''} ${r.reason ?? ''} at ${r.last_checked_at || ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
