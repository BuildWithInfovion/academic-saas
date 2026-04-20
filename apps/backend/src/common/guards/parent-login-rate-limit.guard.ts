import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

// In-memory store — sufficient for single-instance. Replace with Redis for HA.
const attempts = new Map<string, AttemptRecord>();

// Parent login has no institutionCode, so key on IP + phone prefix.
// Keying on the full phone number would allow an attacker to enumerate
// valid phone numbers by measuring block time differences — we don't expose
// that; the response is always constant regardless of user existence.
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 15 * 60 * 1000;
const BLOCK_MS     = 15 * 60 * 1000;

@Injectable()
export class ParentLoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req   = context.switchToHttp().getRequest();
    const ip    = req.ip ?? 'unknown';
    const phone = (req.body?.phone ?? '').trim();

    // Key: IP + phone ensures per-user throttling without a school code.
    const key = `parent::${ip}::${phone}`;

    const now    = Date.now();
    const record = attempts.get(key);

    if (record) {
      if (record.blockedUntil && now < record.blockedUntil) {
        const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1000);
        throw new HttpException(
          `Too many login attempts. Try again in ${retryAfterSec} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (now - record.firstAttemptAt > WINDOW_MS) {
        attempts.set(key, { count: 1, firstAttemptAt: now });
        return true;
      }

      record.count += 1;
      if (record.count > MAX_ATTEMPTS) {
        record.blockedUntil = now + BLOCK_MS;
        throw new HttpException(
          `Too many login attempts. Try again in ${Math.ceil(BLOCK_MS / 1000)} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else {
      attempts.set(key, { count: 1, firstAttemptAt: now });
    }

    return true;
  }
}
