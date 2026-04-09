import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

// ✅ Export this so other files can import it
export interface TenantContext {
  institutionId: string;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const institutionId =
      (request.headers['x-institution-id'] as string) ||
      (request as any).user?.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Missing X-Institution-ID header');
    }

    // ✅ Set request.tenant for tenant.decorator.ts to read
    (request as any).tenant = { institutionId };

    return true;
  }
}