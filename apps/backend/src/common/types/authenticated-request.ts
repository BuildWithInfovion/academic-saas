import type { Request } from 'express';

/** JWT payload set by JwtStrategy after successful token verification. */
export interface JwtUser {
  userId: string;
  institutionId: string;
  roles: string[];
  permissions: string[];
}

/** Tenant context set by TenantGuard / TenantMiddleware. */
export interface TenantCtx {
  institutionId: string;
}

/** Express Request extended with auth + tenant context. */
export interface AuthenticatedRequest extends Request {
  user: JwtUser;
  tenant: TenantCtx;
}
