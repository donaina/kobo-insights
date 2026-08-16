import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { DomainError, NotFoundError, ValidationError } from './errors';
import { MoneyError } from './money';

/**
 * Maps domain and money errors to clean HTTP responses so controllers can just
 * throw. Unknown errors become a 500 without leaking internals.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      reply.status(status).send({ error: exception.message, code: `HTTP_${status}` });
      return;
    }

    if (exception instanceof NotFoundError) {
      reply.status(404).send({ error: exception.message, code: exception.code });
      return;
    }

    if (exception instanceof ValidationError || exception instanceof MoneyError) {
      reply.status(400).send({ error: exception.message, code: 'VALIDATION_ERROR' });
      return;
    }

    if (exception instanceof DomainError) {
      reply.status(400).send({ error: exception.message, code: exception.code });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    reply.status(500).send({ error: 'Internal server error', code: 'INTERNAL' });
  }
}
