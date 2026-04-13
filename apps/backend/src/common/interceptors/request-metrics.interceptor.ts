import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

// Requests slower than this threshold are logged as WARN so they show up clearly.
const SLOW_REQUEST_THRESHOLD_MS = 500;

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const msg = `${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`;

        if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn(`[SLOW] ${msg}`);
        } else {
          this.logger.log(msg);
        }
      }),
    );
  }
}
