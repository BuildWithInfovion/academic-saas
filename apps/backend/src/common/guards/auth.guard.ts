import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  tenant?: { institutionId: string };
  user?: { institutionId?: string };
}

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    // Multi-tenant binding: JWT's institutionId must match the tenant resolved
    // by TenantMiddleware. Prevents a token from school A accessing school B's
    // data even if a controller forgets to scope its DB query by institutionId.
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const tenantId = request.tenant?.institutionId;
    const tokenInstitutionId = (user as { institutionId?: string })
      .institutionId;

    if (tenantId && tokenInstitutionId && tenantId !== tokenInstitutionId) {
      throw new UnauthorizedException(
        'Token does not belong to this institution',
      );
    }

    return user;
  }
}
