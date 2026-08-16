import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  @Get()
  async health() {
    const [statements, transactions] = await Promise.all([
      this.prisma.statement.count(),
      this.prisma.transaction.count(),
    ]);
    return {
      status: 'ok',
      aiEnabled: this.ai.isEnabled(),
      counts: { statements, transactions },
    };
  }
}
