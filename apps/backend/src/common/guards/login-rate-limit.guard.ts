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

// In-memory store — sufficient for single-instance deployments.
// For multi-instance/Redis deployments, replace with an external store.
const attempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 10;        // max login attempts in the window
const WINDOW_MS   = 15 * 60 * 1000; // 15-minute rolling window
const BLOCK_MS    = 15 * 60 * 1000; // block for 15 minutes after exceeding limit

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Key by IP + institution code to avoid punishing unrelated users on the same IP
    const ip   = req.ip ?? 'unknown';
    const code = (req.body?.institutionCode ?? '').toLowerCase().trim();
    const key  = `${ip}::${code}`;

    const now    = Date.now();
    const record = attempts.get(key);

    if (record) {
      // Still blocked?
      if (record.blockedUntil && now < record.blockedUntil) {
        const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1000);
        throw new HttpException(
          `Too many login attempts. Try again in ${retryAfterSec} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Window expired — reset
      if (now - record.firstAttemptAt > WINDOW_MS) {
        attempts.set(key, { count: 1, firstAttemptAt: now });
        return true;
      }

      // Increment within window
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
