import { Controller, Get, Param } from '@nestjs/common';
import { InsightsService } from './insights.service';

@Controller('statements/:id/insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  report(@Param('id') id: string) {
    return this.insights.report(id);
  }
}
