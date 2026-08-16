import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { CategorizationModule } from './categorization/categorization.module';
import { IngestModule } from './ingest/ingest.module';
import { InsightsModule } from './insights/insights.module';
import { AffordabilityModule } from './affordability/affordability.module';
import { AskModule } from './ask/ask.module';
import { StatementsModule } from './statements/statements.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    CategorizationModule,
    IngestModule,
    InsightsModule,
    AffordabilityModule,
    AskModule,
    StatementsModule,
    HealthModule,
  ],
})
export class AppModule {}
