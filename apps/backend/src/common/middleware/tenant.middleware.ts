import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // ✅ Skip preflight
    if (req.method === 'OPTIONS') {
      return next();
    }

    // ✅ Skip auth routes and platform routes (platform has its own auth)
    const url = req.url || req.path;
    const isAuthRoute = url.startsWith('/auth/login') || url.startsWith('/auth/forgot-password');
    const isPlatformRoute = url.startsWith('/platform');
    if (isAuthRoute || isPlatformRoute) {
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