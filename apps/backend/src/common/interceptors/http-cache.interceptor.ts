import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Sets Cache-Control response headers for GET requests.
 *
 * Reference-data routes (fee heads, subjects, academic years, academic units,
 * roles) change rarely — cache them privately in the browser for 5 minutes.
 * Everything else gets no-store so stale data never appears in the UI.
 *
 * "private" ensures proxies/CDNs never share one user's response with another
 * (important for multi-tenant data).
 */
const CACHEABLE_PREFIXES = [
  '/fees/heads',
  '/fees/structures',
  '/academic/years',
  '/academic/units',
  '/subjects',
  '/roles',
  '/timetable',
];

const PRIVATE_CACHE = 'private, max-age=300, stale-while-revalidate=60';
const NO_STORE      = 'no-store';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http     = context.switchToHttp();
    const request  = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // Only set headers on successful GET responses that haven't been set already
        if (request.method !== 'GET') return;
        if (response.headersSent) return;
        if (response.getHeader('Cache-Control')) return;

        const isCacheable = CACHEABLE_PREFIXES.some((prefix) =>
          request.path.startsWith(prefix),
        );

        response.setHeader(
          'Cache-Control',
          isCacheable ? PRIVATE_CACHE : NO_STORE,
        );
      }),
    );
  }
}
