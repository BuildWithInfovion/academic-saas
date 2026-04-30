import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';

// Fields that must never be persisted in audit logs
const SENSITIVE_KEYS = new Set([
  'accessToken', 'refreshToken', 'token', 'passwordHash',
  'password', 'newPassword', 'secret', 'tokenHash',
  'generatedPassword', // L-09: auto-generated parent passwords must not be logged
]);

function stripSensitive(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripSensitive);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    clean[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : stripSensitive(v);
  }
  return clean;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;
    const tenant = request.tenant;

    const method = request.method;
    const url = request.originalUrl;
    const ip = request.ip;

    return next.handle().pipe(
      tap((response) => {
        // Only log state-changing requests — GET responses can be large and add no audit value
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
        if (!tenant?.institutionId) return;

        const pathSegments = url.split('?')[0].split('/').filter(Boolean);
        const entityType = pathSegments[0] ?? null;
        const lastSegment = pathSegments[pathSegments.length - 1];
        const entityId =
          ((response as Record<string, unknown>)?.['id'] as string | null) ??
          (pathSegments.length >= 2 ? lastSegment : null);

        // Fire-and-forget: audit log must never add latency to the API response.
        // setImmediate defers the DB write until after the response is flushed.
        setImmediate(() => {
          this.auditLogService
            .log({
              institutionId: tenant.institutionId,
              userId: user?.userId,
              action: `${method} ${url}`,
              entityType,
              entityId: entityId ?? null,
              newValue: stripSensitive(response),
              ipAddress: ip,
            })
            .catch((error: Error) => {
              console.error('Audit log failed:', error.message);
            });
        });
      }),
    );
  }
}