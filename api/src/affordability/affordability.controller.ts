import { Controller, Get, Param } from '@nestjs/common';
import { AffordabilityService } from './affordability.service';

@Controller('statements/:id/affordability')
export class AffordabilityController {
  constructor(private readonly affordability: AffordabilityService) {}

  @Get()
  snapshot(@Param('id') id: string) {
    return this.affordability.snapshot(id);
  }
}
