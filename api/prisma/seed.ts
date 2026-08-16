import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IngestService } from '../src/ingest/ingest.service';

/**
 * Seeds the synthetic sample statement by running it through the real ingest
 * pipeline (parse -> store -> categorize). Idempotent: if a SAMPLE statement
 * already exists it does nothing, so `npm run seed` is safe to re-run.
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const prisma = app.get(PrismaService);
    const existing = await prisma.statement.findFirst({ where: { source: 'SAMPLE' } });
    if (existing) {
      logger.log(`Sample statement already present (${existing.id}); skipping seed.`);
      return;
    }

    const csvPath = join(__dirname, '..', '..', 'sample-data', 'sample-statement.csv');
    const csv = readFileSync(csvPath, 'utf8');

    const ingest = app.get(IngestService);
    const result = await ingest.ingestCsv(csv, {
      label: 'Ada O. — Sample Statement (synthetic)',
      source: 'SAMPLE',
      bankHint: 'GTBank',
      accountName: 'Ada O. (synthetic)',
    });

    logger.log(
      `Seeded sample statement ${result.statementId}: ${result.transactions} txns, ` +
        `${result.categorization.byRules} by rules, ${result.categorization.byAi} by AI, ` +
        `${result.categorization.uncategorized} uncategorized.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
