import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { StatementsService } from './statements.service';
import { UploadStatementDto } from './dto/upload-statement.dto';

@Controller('statements')
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get()
  list() {
    return this.statements.list();
  }

  @Post()
  upload(@Body() dto: UploadStatementDto) {
    return this.statements.upload(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.statements.get(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.statements.remove(id);
  }
}
