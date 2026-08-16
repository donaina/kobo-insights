import { Body, Controller, Param, Post } from '@nestjs/common';
import { AskService } from './ask.service';
import { AskDto } from './dto/ask.dto';

@Controller('statements/:id/ask')
export class AskController {
  constructor(private readonly ask: AskService) {}

  @Post()
  question(@Param('id') id: string, @Body() dto: AskDto) {
    return this.ask.ask(id, dto.question);
  }
}
