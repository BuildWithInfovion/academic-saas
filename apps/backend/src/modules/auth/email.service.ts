import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.from =
      process.env.EMAIL_FROM ?? 'Infovion <noreply@buildwithinfovion.com>';
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!apiKey) {
      this.logger.warn(
        '[EmailService] RESEND_API_KEY not set — emails logged to console only',
      );
    }
  }

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    institutionName?: string,
  ): Promise<void> {
    const school = institutionName ? ` for ${institutionName}` : '';

    if (!this.resend) {
      this.logger.warn(
        `[EMAIL-CONSOLE] Password reset OTP${school} → ${email} : ${otp}`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Your password reset code',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#ae5525">Password Reset${school}</h2>
            <p>Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:0.2em;
                        padding:16px 24px;background:#fdf4e9;border-radius:8px;
                        display:inline-block;color:#2d1a0e;margin:16px 0">
              ${otp}
            </div>
            <p style="color:#666;font-size:13px">
              If you did not request a password reset, ignore this email — your account is safe.
            </p>
          </div>
        `,
      });
      this.logger.log(`[EmailService] Reset OTP sent → ${email}`);
    } catch (err) {
      this.logger.error(
        `[EmailService] Send failed for ${email}: ${(err as Error).message}`,
      );
      // Log OTP as emergency fallback so an admin can relay it manually
      this.logger.warn(
        `[EMAIL-FALLBACK] Reset OTP for ${email}: ${otp} (email delivery failed)`,
      );
    }
  }
}
