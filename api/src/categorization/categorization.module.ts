import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [CategorizationService],
  exports: [CategorizationService],
})
export class CategorizationModule {}
