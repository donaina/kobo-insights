import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { CategorizationModule } from '../categorization/categorization.module';

@Module({
  imports: [CategorizationModule],
  providers: [IngestService],
  exports: [IngestService],
})
export class IngestModule {}
