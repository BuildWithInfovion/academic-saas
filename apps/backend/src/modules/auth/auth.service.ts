import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from './email.service';
import { generatePassword } from '../../common/utils/generate-password';

type RoleWithPermissions = {
  role: { code: string; permissions: unknown };
};

// ── Inline TOTP (RFC 6238 + RFC 4226) — zero extra dependency ─────────────────
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str: string): Buffer {
  const input = str.replace(/=/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0,
    value = 0;
  for (const ch of input) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpGenerate(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

function totpVerify(token: string, secret: string | null, window = 1): boolean {
  if (!secret) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (totpGenerate(secret, step + i) === token) return true;
  }
  return false;
}

function totpGenerateSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  return Array.from(buf, (b) => BASE32_ALPHABET[b % 32]).join('');
}
// ──────────────────────────────────────────────────────────────────────────────

// Password reset OTP lifetime: 10 minutes
const RESET_OTP_TTL_MS = 10 * 60 * 1000;

// How many TOTP backup codes to generate at setup
const BACKUP_CODE_COUNT = 8;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ── Institution helpers ────────────────────────────────────────────────────

  async resolveInstitution(
    code: string,
  ): Promise<{ id: string; name: string }> {
    const normalized = code.toLowerCase().trim();
    const institution = await this.prisma.institution.findUnique({
      where: { code: normalized },
      select: { id: true, name: true, status: true, deletedAt: true },
    });
    if (!institution || institution.deletedAt) {
      throw new NotFoundException(
        `No institution found with code "${normalized}"`,
      );
    }
    if (institution.status !== 'active') {
      throw new UnauthorizedException('This institution account is inactive');
    }
    return { id: institution.id, name: institution.name };
  }

  // ── Email + Password login (staff / operators) ─────────────────────────────

  /**
   * Validates email+password. If TOTP is enabled on the account, returns a
   * short-lived `totpToken` (5 min) instead of the full JWT so the client can
   * complete the TOTP challenge before a full session is issued.
   */
  async login(institutionCode: string, email: string, password: string) {
    const { id: institutionId, name: institutionName } =
      await this.resolveInstitution(institutionCode);

    // Fetch ALL active users matching this credential — multiple records can
    // exist when the same person holds different roles (e.g. operator + director).
    const candidates = await this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
        isActive: true,
        OR: [
          { email: { equals: email.trim(), mode: 'insensitive' } },
          { phone: email.trim() },
        ],
      },
      include: { roles: { include: { role: true } } },
    });

    // Generic error — never reveal whether email or password was wrong
    const INVALID = new UnauthorizedException('Invalid credentials');

    if (candidates.length === 0) {
      await bcrypt.compare(
        password,
        '$2b$12$invalidhashpaddinginvalid000000000000000000000000000000',
      );
      throw INVALID;
    }

    // Role priority — higher number wins when multiple records share credentials.
    // super_admin (Director) beats admin (Operator) so the director always gets in.
    const ROLE_PRIORITY: Record<string, number> = {
      student: 0,
      parent: 1,
      non_teaching_staff: 2,
      accountant: 3,
      receptionist: 4,
      teacher: 5,
      principal: 6,
      admin: 7,
      super_admin: 8,
    };
    const userPriority = (u: (typeof candidates)[0]) =>
      Math.max(-1, ...u.roles.map((ur) => ROLE_PRIORITY[ur.role.code] ?? -1));

    // Verify password against every candidate; keep those that match.
    const checks = await Promise.all(
      candidates.map(async (u) => ({
        user: u,
        valid: u.passwordHash
          ? await bcrypt.compare(password, u.passwordHash)
          : false,
      })),
    );

    const validMatches = checks
      .filter((c) => c.valid)
      .sort((a, b) => userPriority(b.user) - userPriority(a.user));

    if (validMatches.length === 0) throw INVALID;

    const user = validMatches[0].user;
    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);

    // TOTP challenge: issue a short-lived pending token — no full session yet
    if (user.totpEnabled) {
      const totpToken = await this.jwtService.signAsync(
        { sub: user.id, institutionId, purpose: 'totp_pending' },
        { expiresIn: '5m' },
      );
      this.logger.log(
        `[login] TOTP required — userId=${user.id} institution=${institutionId}`,
      );
      return { requiresTOTP: true as const, totpToken, institutionName };
    }

    return this.issueFullSession(
      user,
      institutionId,
      institutionName,
      roles,
      permissions,
    );
  }

  // ── TOTP authentication (second factor) ────────────────────────────────────

  /**
   * Completes login when TOTP is enabled. Accepts the `totpToken` issued by
   * `login()` plus the 6-digit TOTP code (or a one-time backup code).
   */
  async authenticateTotp(totpToken: string, code: string) {
    // Verify the pending token
    let pending: { sub: string; institutionId: string; purpose: string };
    try {
      pending = await this.jwtService.verifyAsync<typeof pending>(totpToken);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    if (pending.purpose !== 'totp_pending') {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: pending.sub, isActive: true, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });

    if (!user?.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('TOTP not configured');
    }

    const trimmedCode = code.replace(/\s/g, '');
    const isValidTotp = totpVerify(trimmedCode, user.totpSecret);

    if (!isValidTotp) {
      // Try backup codes — strip hyphens to match the format used at generation time
      const codeHash = crypto
        .createHash('sha256')
        .update(trimmedCode.replace(/-/g, ''))
        .digest('hex');
      const backupIndex = user.totpBackupCodes.indexOf(codeHash);

      if (backupIndex === -1) {
        this.logger.warn(`[authenticateTotp] Invalid code — userId=${user.id}`);
        throw new UnauthorizedException('Invalid authentication code');
      }

      // Consume backup code — remove it so it cannot be reused
      const remaining = [...user.totpBackupCodes];
      remaining.splice(backupIndex, 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: remaining },
      });
      this.logger.warn(
        `[authenticateTotp] Backup code used — userId=${user.id} remaining=${remaining.length}`,
      );
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: user.institutionId },
      select: { name: true },
    });

    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);
    this.logger.log(
      `[authenticateTotp] Login success — userId=${user.id} institution=${user.institutionId}`,
    );
    return this.issueFullSession(
      user,
      user.institutionId,
      institution?.name ?? '',
      roles,
      permissions,
    );
  }

  // ── TOTP setup ─────────────────────────────────────────────────────────────

  /**
   * Generates a new TOTP secret for the user and returns the QR code data URI
   * and the raw secret (for manual entry). Does NOT enable TOTP yet — the user
   * must call confirmTotp() first to prove their authenticator is working.
   */
  async setupTotp(
    userId: string,
  ): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, totpEnabled: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.totpEnabled)
      throw new BadRequestException('TOTP is already enabled');

    const secret = totpGenerateSecret(32);
    const label = encodeURIComponent(user.email ?? user.phone ?? userId);
    const issuer = encodeURIComponent('Infovion');
    const uri = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await qrcode.toDataURL(uri);

    // Store secret in DB (not yet enabled — user must confirm first)
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return { qrCodeDataUrl, secret };
  }

  /**
   * Verifies the first code from the user's authenticator app, then enables
   * TOTP and returns one-time backup codes (shown once, never retrievable again).
   */
  async confirmTotp(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpSecret)
      throw new BadRequestException('Run TOTP setup first');
    if (user.totpEnabled)
      throw new BadRequestException('TOTP is already active');

    const isValid = totpVerify(code.replace(/\s/g, ''), user.totpSecret);
    if (!isValid)
      throw new UnauthorizedException(
        'Invalid code — check your authenticator app',
      );

    // Generate backup codes: 8 × "XXXX-XXXX" format
    const rawCodes: string[] = Array.from({ length: BACKUP_CODE_COUNT }, () => {
      const bytes = crypto.randomBytes(5);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const part = (start: number) =>
        Array.from(
          { length: 4 },
          (_, i) => chars[bytes[start + i] % chars.length],
        ).join('');
      return `${part(0)}-${part(1)}`;
    });
    const hashedCodes = rawCodes.map((c) =>
      crypto.createHash('sha256').update(c.replace(/-/g, '')).digest('hex'),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpBackupCodes: hashedCodes },
    });

    this.logger.log(`[confirmTotp] TOTP enabled — userId=${userId}`);
    return { backupCodes: rawCodes };
  }

  /**
   * Disables TOTP after verifying the current TOTP code (or a backup code).
   * Clears secret and all backup codes.
   */
  async disableTotp(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        totpSecret: true,
        totpEnabled: true,
        totpBackupCodes: true,
      },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled');
    }

    const trimmed = code.replace(/\s/g, '');
    const isValidTotp = totpVerify(trimmed, user.totpSecret);

    if (!isValidTotp) {
      const codeHash = crypto
        .createHash('sha256')
        .update(trimmed.replace(/-/g, ''))
        .digest('hex');
      if (!user.totpBackupCodes.includes(codeHash)) {
        throw new UnauthorizedException('Invalid code');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false, totpBackupCodes: [] },
    });
    this.logger.log(`[disableTotp] TOTP disabled — userId=${userId}`);
  }

  // ── TOTP status ─────────────────────────────────────────────────────────────

  async getTotpStatus(
    userId: string,
  ): Promise<{ enabled: boolean; backupCodesRemaining: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, totpBackupCodes: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      enabled: user.totpEnabled,
      backupCodesRemaining: user.totpBackupCodes.length,
    };
  }

  // ── Token refresh ───────────────────────────────────────────────────────────

  async refreshByToken(token: string, institutionId?: string) {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        isRevoked: false,
        ...(institutionId ? { institutionId } : {}),
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [user, institution] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: storedToken.userId,
          institutionId: storedToken.institutionId,
          deletedAt: null,
          isActive: true,
        },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.institution.findUnique({
        where: { id: storedToken.institutionId },
        select: { name: true },
      }),
    ]);

    if (!user) throw new UnauthorizedException('User not found');

    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);
    const newAccessToken = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.id,
      institutionId: user.institutionId,
      roles,
      permissions,
    });

    const rawToken = crypto.randomBytes(64).toString('hex');
    const newTokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          institutionId: user.institutionId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: rawToken,
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email,
        phone: user.phone,
        institutionId: user.institutionId,
        institutionName: institution?.name ?? null,
        roles,
        permissions,
      },
    };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, institutionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, institutionId, isRevoked: false },
      data: { isRevoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  // ── Password reset (self-service via email OTP) ─────────────────────────────

  /**
   * Sends a 6-digit OTP to the user's registered email.
   * Always returns the same constant response — never leaks whether the email exists.
   */
  async requestPasswordResetOtp(institutionCode: string, email: string) {
    const CONSTANT = {
      message:
        'If an account with this email exists, a reset code has been sent.',
    };

    let institutionId: string;
    let institutionName: string | undefined;
    try {
      const inst = await this.resolveInstitution(institutionCode);
      institutionId = inst.id;
      institutionName = inst.name;
    } catch {
      return CONSTANT;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        institutionId,
        email: normalizedEmail,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user) return CONSTANT;

    // Invalidate any previous unused reset OTPs for this email+institution
    await this.prisma.passwordResetOtp.updateMany({
      where: { institutionId, email: normalizedEmail, isUsed: false },
      data: { isUsed: true },
    });

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    await this.prisma.passwordResetOtp.create({
      data: {
        institutionId,
        email: normalizedEmail,
        otpHash,
        expiresAt: new Date(Date.now() + RESET_OTP_TTL_MS),
      },
    });

    this.emailService
      .sendPasswordResetOtp(normalizedEmail, otp, institutionName)
      .catch((err: unknown) => {
        this.logger.error(
          `[requestPasswordResetOtp] Email threw: ${String(err)}`,
        );
      });

    return CONSTANT;
  }

  /**
   * Verifies the reset OTP and sets the new password.
   * Enforces the same password strength rules as user creation.
   */
  async resetPassword(
    institutionCode: string,
    email: string,
    otp: string,
    newPassword: string,
  ) {
    this.validatePasswordStrength(newPassword);

    const { id: institutionId } =
      await this.resolveInstitution(institutionCode);
    const INVALID = new UnauthorizedException('Invalid or expired code.');
    const normalizedEmail = email.trim().toLowerCase();

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: {
        institutionId,
        email: normalizedEmail,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw INVALID;

    const providedHash = crypto
      .createHash('sha256')
      .update(otp.trim())
      .digest('hex');
    const storedBuf = Buffer.from(record.otpHash, 'hex');
    const providedBuf = Buffer.from(providedHash, 'hex');

    const isMatch =
      storedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(storedBuf, providedBuf);

    if (!isMatch) throw INVALID;

    await this.prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        institutionId,
        email: normalizedEmail,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user) throw INVALID;

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.log(
      `[resetPassword] Password reset — userId=${user.id} institution=${institutionId}`,
    );
    return { message: 'Password reset successfully.' };
  }

  // ── Parent login ────────────────────────────────────────────────────────────

  /**
   * Phone + password login for parents. No school code required — institution
   * is auto-resolved from the phone number.
   * Parents never get TOTP — too complex for non-technical users.
   */
  async parentLogin(phone: string, password: string) {
    const INVALID = new UnauthorizedException(
      'Invalid phone number or password.',
    );

    const candidates = await this.prisma.user.findMany({
      where: {
        phone,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { code: 'parent' } } },
      },
      include: {
        roles: { include: { role: true } },
        institution: {
          select: { id: true, name: true, status: true, deletedAt: true },
        },
      },
    });

    const active = candidates.filter(
      (u) =>
        u.institution &&
        !u.institution.deletedAt &&
        u.institution.status === 'active',
    );

    if (active.length === 0) {
      await bcrypt.compare(
        password,
        '$2b$12$invalidhashpaddinginvalid000000000000000000000000000000',
      );
      throw INVALID;
    }

    if (active.length > 1) {
      this.logger.warn(
        `[parentLogin] Ambiguous phone across ${active.length} institutions — phone=${phone.slice(0, 5)}***`,
      );
      throw new BadRequestException(
        'Multiple school accounts found for this number. Please contact your school administrator.',
      );
    }

    const user = active[0];
    if (!user.passwordHash) {
      await bcrypt.compare(
        password,
        '$2b$12$invalidhashpaddinginvalid000000000000000000000000000000',
      );
      throw INVALID;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw INVALID;

    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);
    this.logger.log(
      `[parentLogin] Login success — userId=${user.id} institution=${user.institutionId}`,
    );

    return this.issueFullSession(
      user,
      user.institutionId,
      user.institution.name,
      roles,
      permissions,
    );
  }

  // ── Parent: submit password reset request ─────────────────────────────────

  async requestParentPasswordReset(
    phone: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        phone,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { code: 'parent' } } },
      },
      select: { id: true, institutionId: true },
    });

    // Always return success to avoid phone enumeration
    if (!user) return { message: 'Request submitted' };

    const existing = await this.prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, institutionId: user.institutionId, status: 'pending' },
    });
    if (!existing) {
      await this.prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          institutionId: user.institutionId,
          status: 'pending',
        },
      });
    }

    this.logger.log(
      `[requestParentPasswordReset] Reset request — userId=${user.id}`,
    );
    return { message: 'Request submitted' };
  }

  // ── Operator: reset parent password ────────────────────────────────────────

  /**
   * Operator directly sets a new random password for a parent account.
   * Returns the new plain-text password to display once in the dashboard.
   */
  async resetParentPassword(
    institutionId: string,
    parentUserId: string,
  ): Promise<{ newPassword: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: parentUserId,
        institutionId,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { code: 'parent' } } },
      },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException('Parent user not found in this institution');

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.log(
      `[resetParentPassword] Password reset by operator — userId=${user.id} institution=${institutionId}`,
    );
    return { newPassword };
  }

  // ── Director: reset any staff member's password ───────────────────────────

  async resetStaffPassword(
    institutionId: string,
    userId: string,
  ): Promise<{ newPassword: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException('User not found in this institution');

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.log(
      `[resetStaffPassword] Password reset by director — userId=${user.id} institution=${institutionId}`,
    );
    return { newPassword };
  }

  // ── Operator: password reset request approval (kept for legacy/audit) ────────

  async getPendingResetRequests(institutionId: string) {
    return this.prisma.passwordResetRequest.findMany({
      where: { institutionId, status: 'pending' },
      include: { user: { select: { id: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveResetRequest(institutionId: string, requestId: string) {
    const request = await this.prisma.passwordResetRequest.findFirst({
      where: { id: requestId, institutionId, status: 'pending' },
    });
    if (!request) throw new NotFoundException('Reset request not found');

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: { status: 'approved' },
      }),
    ]);
    return { newPassword };
  }

  async rejectResetRequest(institutionId: string, requestId: string) {
    const request = await this.prisma.passwordResetRequest.findFirst({
      where: { id: requestId, institutionId, status: 'pending' },
    });
    if (!request) throw new NotFoundException('Reset request not found');

    await this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });
    return { message: 'Request rejected' };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async issueFullSession(
    user: {
      id: string;
      name?: string | null;
      email: string | null;
      phone: string | null;
      institutionId: string;
    },
    institutionId: string,
    institutionName: string,
    roles: string[],
    permissions: string[],
  ) {
    const payload = {
      sub: user.id,
      userId: user.id,
      institutionId,
      roles,
      permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.id, institutionId),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email,
        phone: user.phone,
        institutionId,
        institutionName,
        roles,
        permissions,
      },
    };
  }

  private async generateRefreshToken(userId: string, institutionId: string) {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, institutionId, tokenHash, expiresAt },
    });
    return rawToken;
  }

  private validatePasswordStrength(password: string) {
    if (password.length < 8)
      throw new BadRequestException('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password))
      throw new BadRequestException(
        'Password must contain at least one uppercase letter',
      );
    if (!/[a-z]/.test(password))
      throw new BadRequestException(
        'Password must contain at least one lowercase letter',
      );
    if (!/[0-9]/.test(password))
      throw new BadRequestException(
        'Password must contain at least one number',
      );
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private extractRoles(userRoles: RoleWithPermissions[]): string[] {
    return userRoles.map((ur) => ur.role.code);
  }

  private extractPermissions(userRoles: RoleWithPermissions[]): string[] {
    const all = userRoles.flatMap((ur) => {
      const raw = ur.role.permissions;
      return Array.isArray(raw)
        ? raw.filter((p): p is string => typeof p === 'string')
        : [];
    });
    return [...new Set(all)];
  }
}
