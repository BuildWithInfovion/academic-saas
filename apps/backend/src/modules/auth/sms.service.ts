import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS delivery service — OTP dispatch abstraction.
 *
 * Provider selection via SMS_PROVIDER env var:
 *   fast2sms  → Fast2SMS REST API  (recommended for India, free tier available)
 *   console   → log to stdout only (default when SMS_PROVIDER is unset)
 *
 * Required env vars for Fast2SMS:
 *   SMS_PROVIDER=fast2sms
 *   SMS_API_KEY=<your Fast2SMS API key>
 *
 * Get a free Fast2SMS account + API key at: https://www.fast2sms.com
 * Free tier gives ~100 SMS credits for testing.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const provider = (process.env.SMS_PROVIDER ?? 'console')
      .toLowerCase()
      .trim();

    try {
      if (provider === 'fast2sms') {
        await this.sendViaFast2Sms(phone, otp);
      } else {
        this.logToConsole(phone, otp);
      }
    } catch (err) {
      // SMS failure must never crash the OTP request — the OTP is already in
      // the DB and valid. Log the OTP to server output as an emergency fallback
      // so an admin can relay it manually if needed.
      this.logger.error(
        `[SmsService] Delivery failed via provider="${provider}": ${(err as Error).message}`,
      );
      this.logger.warn(
        `[SMS-FALLBACK] OTP for ${this.mask(phone)}: ${otp}  (SMS delivery failed — check provider config)`,
      );
    }
  }

  // ── Fast2SMS ────────────────────────────────────────────────────────────────

  private async sendViaFast2Sms(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) {
      throw new Error('SMS_API_KEY is not set — required for Fast2SMS');
    }

    // Fast2SMS expects a 10-digit Indian mobile number (no country code).
    const normalizedPhone = this.normalizeIndianPhone(phone);

    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'otp',
      variables_values: otp,
      flash: '0',
      numbers: normalizedPhone,
    });

    const res = await fetch(
      `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(10_000), // 10 s hard timeout
      },
    );

    if (!res.ok) {
      throw new Error(`Fast2SMS HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      return: boolean;
      request_id?: string;
      message?: string[];
    };

    if (!data.return) {
      throw new Error(
        `Fast2SMS rejected: ${data.message?.join(', ') ?? 'unknown error'}`,
      );
    }

    this.logger.log(
      `[Fast2SMS] OTP dispatched → ${this.mask(phone)}  request_id=${data.request_id ?? 'n/a'}`,
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private logToConsole(phone: string, otp: string): void {
    this.logger.warn(
      `[SMS-CONSOLE] OTP for ${phone}: ${otp}  ← set SMS_PROVIDER=fast2sms for real delivery`,
    );
  }

  /** Strip +91 / 91 prefix and return the bare 10-digit number. */
  private normalizeIndianPhone(phone: string): string {
    return phone
      .replace(/^\+91/, '')
      .replace(/^91/, '')
      .replace(/\s+/g, '')
      .trim();
  }

  /** Mask phone for safe logging — show first 5 digits only. */
  private mask(phone: string): string {
    const digits = this.normalizeIndianPhone(phone);
    return `${digits.slice(0, 5)}*****`;
  }
}
