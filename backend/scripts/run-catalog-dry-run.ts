import dotenv from 'dotenv';
dotenv.config();

import { CatalogIngestionService } from '../src/services/catalogIngestionService';

async function main() {
  const queriesArg = process.argv.includes('--queries')
    ? process.argv[process.argv.indexOf('--queries') + 1]
    : '';

  const queries = queriesArg
    ? queriesArg.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;

  const res = await CatalogIngestionService.dryRunDiscover({ queries });
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error('Dry-run failed:', err);
  process.exit(1);
});

