import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type AnyPrismaError =
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientUnknownRequestError
  | Prisma.PrismaClientRustPanicError
  | Prisma.PrismaClientInitializationError
  | Prisma.PrismaClientValidationError;

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: AnyPrismaError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const code =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? ` [${exception.code}]`
        : '';
    this.logger.error(
      `Prisma error${code} on ${request.method} ${request.url}: ${exception.message}`,
      exception.stack,
    );

    // Validation error → 400
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data',
      });
    }

    // Initialization / connection error → 503
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database temporarily unavailable. Please try again in a moment.',
      });
    }

    // Rust panic (should never happen in prod) → 503
    if (exception instanceof Prisma.PrismaClientRustPanicError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Internal server error. Please try again.',
      });
    }

    // Unknown request error → 500
    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected database error occurred.',
      });
    }

    // Known error codes
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    const knownErr = exception as Prisma.PrismaClientKnownRequestError;
    // Always include code and a truncated message in the default path so
    // unknown errors are diagnosable without needing live log access.
    message = `Database error [${knownErr.code}]: ${String(knownErr.message).slice(0, 200)}`;

    switch (knownErr.code) {
      case 'P2002': {
        const target = Array.isArray(knownErr.meta?.['target'])
          ? (knownErr.meta['target'] as string[]).join(', ')
          : null;
        status = HttpStatus.CONFLICT;
        message = target
          ? `A record with this ${target} already exists`
          : 'A record with this value already exists';
        break;
      }
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Related record not found';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2021':
      case 'P2022':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database schema is out of date. Run the latest migrations and retry.';
        break;
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
        // Connection-related codes
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database temporarily unavailable. Please try again.';
        break;
    }

    response.status(status).json({ statusCode: status, message });
  }
}
