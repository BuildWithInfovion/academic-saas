import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';

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
      tap(async (response) => {
        try {
          if (!tenant?.institutionId) return;

          await this.auditLogService.log({
            institutionId: tenant.institutionId,
            userId: user?.userId,
            action: `${method} ${url}`,
            entityType: url.split('/')[1], // e.g. students, users
            entityId: response?.id || null,
            newValue: response,
            ipAddress: ip,
          });
        } catch (error) {
          // ❌ Never break main flow due to logging failure
          console.error('Audit log failed:', error.message);
        }
      }),
    );
  }
}