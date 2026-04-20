import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS delivery abstraction.
 *
 * Current implementation: logs to console only (development mode).
 *
 * To integrate a real provider, replace the body of sendOtp() and inject
 * the provider client here. Suggested providers for India:
 *   - Fast2SMS  (https://www.fast2sms.com)
 *   - MSG91     (https://msg91.com)
 *   - Twilio    (https://www.twilio.com)
 *
 * Required env vars (add to .env and .env.example):
 *   SMS_PROVIDER=fast2sms          # fast2sms | msg91 | twilio | console
 *   SMS_API_KEY=<provider-api-key>
 *   SMS_SENDER_ID=SCHOOL            # 6-char sender ID (India DLT requirement)
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    // TODO: Replace with real SMS provider when credentials are available.
    // The OTP is intentionally printed to the backend console so developers
    // and on-prem admins can test the flow without a live SIM card.
    this.logger.warn(
      `[SMS-STUB] OTP for +91${phone}: ${otp}  ← integrate a real SMS provider before production`,
    );
  }
}
