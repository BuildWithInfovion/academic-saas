import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // ✅ Skip preflight
    if (req.method === 'OPTIONS') {
      return next();
    }

    // ✅ Skip auth routes, platform routes, and support routes
    // Support routes use JWT-only auth — no tenant header required.
    const url = req.url || req.path;
    const isAuthRoute =
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/refresh') ||          // covers /auth/refresh and /auth/refresh-op
      url.startsWith('/auth/forgot-password') ||
      url.startsWith('/auth/reset-password') ||   // email OTP password reset (no tenant header)
      url.startsWith('/auth/totp/authenticate') || // TOTP challenge uses temp JWT (no tenant header)
      url.startsWith('/auth/parent/');             // parent phone+password login (no tenant header)
    const isPlatformRoute = url.startsWith('/platform');
    const isSupportRoute = url.startsWith('/support');
    if (isAuthRoute || isPlatformRoute || isSupportRoute) {
      return next();
    }

    const institutionId = req.headers['x-institution-id'] as string;

    if (!institutionId) {
      throw new BadRequestException('Missing X-Institution-ID header');
    }

    // ✅ Attach to req so tenant.decorator.ts can read it
    (req as any).tenant = { institutionId };

    next();
  }
}