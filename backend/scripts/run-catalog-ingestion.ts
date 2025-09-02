import dotenv from 'dotenv';
dotenv.config();

import { CatalogIngestionService } from '../src/services/catalogIngestionService';

async function main() {
  const res = await CatalogIngestionService.discoverAndIngest();
  console.log(`Discovery complete:`, res);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Catalog ingestion failed:', err);
  process.exit(1);
});

