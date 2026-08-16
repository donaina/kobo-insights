import { Module } from '@nestjs/common';
import { AffordabilityService } from './affordability.service';
import { AffordabilityController } from './affordability.controller';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [InsightsModule],
  controllers: [AffordabilityController],
  providers: [AffordabilityService],
  exports: [AffordabilityService],
})
export class AffordabilityModule {}
