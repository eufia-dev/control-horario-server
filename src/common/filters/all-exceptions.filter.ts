import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface NormalizedException {
  status: number;
  message: string;
  error?: string;
  details?: unknown;
  internalMessage?: string;
}

/**
 * Global exception filter that logs all errors and returns
 * Spanish-friendly messages to the frontend.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalizeException(exception);

    this.logger.error(
      `[${request.method}] ${request.url} -> ${normalized.status} ${normalized.internalMessage ?? normalized.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(normalized.status).json({
      statusCode: normalized.status,
      message: normalized.message,
      error: normalized.error,
      details: normalized.details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeException(exception: unknown): NormalizedException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const fallback =
        'Ha ocurrido un error al procesar la solicitud. Inténtalo de nuevo.';
      let message = fallback;
      let errorCode: string | undefined;
      let details: unknown;

      if (typeof response === 'string') {
        message = response || fallback;
      } else if (typeof response === 'object' && response !== null) {
        const res = response as { message?: unknown; error?: unknown };
        errorCode =
          typeof res.error === 'string' && res.error.trim().length > 0
            ? res.error
            : undefined;

        if (Array.isArray(res.message)) {
          details = res.message;
          message =
            'Los datos enviados no son válidos. Revisa los campos requeridos.';
        } else if (
          typeof res.message === 'string' &&
          res.message.trim().length > 0
        ) {
          message = res.message;
        } else if (
          typeof res.error === 'string' &&
          res.error.trim().length > 0
        ) {
          message = res.error;
        }
      }

      return {
        status,
        message,
        error: errorCode ?? exception.name,
        details,
        internalMessage: this.extractInternalMessage(exception),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
      error: 'INTERNAL_SERVER_ERROR',
      details: undefined,
      internalMessage: this.extractInternalMessage(exception),
    };
  }

  private extractInternalMessage(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.message;
    }
    if (typeof exception === 'string') {
      return exception;
    }
    return undefined;
  }
}
