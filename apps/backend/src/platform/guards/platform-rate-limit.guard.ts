import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface WindowEntry {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

/**
 * Stricter rate-limit guard for the platform (developer) portal.
 *
 * Policy: 5 attempts per 30-minute window → 60-minute block on the IP.
 * Keyed by IP only (no institution context for the dev portal).
 *
 * Intentionally more restrictive than LoginRateLimitGuard (10/15m window):
 * the dev portal has a very small, known user base (≤2 admins), so a
 * brute-force attempt almost certainly signals an attacker.
 */
@Injectable()
export class PlatformRateLimitGuard implements CanActivate {
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly WINDOW_MS = 30 * 60 * 1000;   // 30 minutes
  private static readonly BLOCK_MS  = 60 * 60 * 1000;   // 60 minutes

  private readonly store = new Map<string, WindowEntry>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip: string =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const now = Date.now();
    const entry = this.store.get(ip);

    // Currently blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      const retryAfterSec = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`,
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Reset window if expired
    if (!entry || now - entry.windowStart > PlatformRateLimitGuard.WINDOW_MS) {
      this.store.set(ip, { count: 1, windowStart: now });
      return true;
    }

    entry.count += 1;

    if (entry.count > PlatformRateLimitGuard.MAX_ATTEMPTS) {
      entry.blockedUntil = now + PlatformRateLimitGuard.BLOCK_MS;
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many failed attempts. Your IP has been blocked for 60 minutes.',
          retryAfter: PlatformRateLimitGuard.BLOCK_MS / 1000,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
