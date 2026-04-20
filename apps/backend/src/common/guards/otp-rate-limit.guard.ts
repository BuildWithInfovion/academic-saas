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
const otpRequests = new Map<string, AttemptRecord>();

// 3 OTP sends per phone+institutionCode per 10-minute window.
// Stricter than login because SMS is a scarce resource and OTP request
// leaks that a user exists (even with a constant response).
const MAX_REQUESTS = 3;
const WINDOW_MS    = 10 * 60 * 1000;
const BLOCK_MS     = 10 * 60 * 1000;

@Injectable()
export class OtpRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req  = context.switchToHttp().getRequest();
    const ip   = req.ip ?? 'unknown';
    const code = (req.body?.institutionCode ?? '').toLowerCase().trim();
    const phone = (req.body?.phone ?? '').trim();

    // Key includes both IP and phone+code to prevent:
    //   1. An attacker hammering one victim's phone from many IPs (keyed on phone)
    //   2. A shared-IP source hammering many users (keyed on IP)
    // We use the stricter: per-phone+code regardless of IP.
    const key = `otp::${code}::${phone}`;

    const now    = Date.now();
    const record = otpRequests.get(key);

    if (record) {
      if (record.blockedUntil && now < record.blockedUntil) {
        const retryAfterSec = Math.ceil((record.blockedUntil - now) / 1000);
        throw new HttpException(
          `Too many OTP requests. Try again in ${retryAfterSec} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (now - record.firstAttemptAt > WINDOW_MS) {
        otpRequests.set(key, { count: 1, firstAttemptAt: now });
        return true;
      }

      record.count += 1;
      if (record.count > MAX_REQUESTS) {
        record.blockedUntil = now + BLOCK_MS;
        throw new HttpException(
          `Too many OTP requests. Try again in ${Math.ceil(BLOCK_MS / 1000)} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } else {
      otpRequests.set(key, { count: 1, firstAttemptAt: now });
    }

    return true;
  }
}
