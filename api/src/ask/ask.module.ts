import { Module } from '@nestjs/common';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { InsightsModule } from '../insights/insights.module';
import { AffordabilityModule } from '../affordability/affordability.module';

@Module({
  imports: [InsightsModule, AffordabilityModule],
  controllers: [AskController],
  providers: [AskService],
})
export class AskModule {}
