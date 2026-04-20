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
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SmsService } from './sms.service';

type RoleWithPermissions = {
  role: {
    code: string;
    permissions: unknown;
  };
};

// Maximum failed OTP verification attempts before the record is invalidated.
const OTP_MAX_ATTEMPTS = 5;
// OTP lifetime in milliseconds.
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {}

  async resolveInstitution(code: string): Promise<{ id: string; name: string }> {
    const normalizedCode = code.toLowerCase().trim();

    const institution = await this.prisma.institution.findUnique({
      where: { code: normalizedCode },
      select: { id: true, name: true, status: true, deletedAt: true },
    });

    if (!institution || institution.deletedAt) {
      throw new NotFoundException(
        `No institution found with code "${normalizedCode}"`,
      );
    }

    if (institution.status !== 'active') {
      throw new UnauthorizedException('This institution account is inactive');
    }

    return { id: institution.id, name: institution.name };
  }

  /** @deprecated use resolveInstitution */
  async resolveInstitutionCode(code: string): Promise<string> {
    return (await this.resolveInstitution(code)).id;
  }

  async login(institutionCode: string, email: string, password: string) {
    const { id: institutionId, name: institutionName } =
      await this.resolveInstitution(institutionCode);

    const user = await this.usersService.findByEmailOrPhone(
      institutionId,
      email,
    );

    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);

    const payload = {
      sub: user.id,
      userId: user.id,
      institutionId: user.institutionId,
      roles,
      permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.generateRefreshToken(
      user.id,
      user.institutionId,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        institutionId: user.institutionId,
        institutionName,
        roles,
        permissions,
      },
    };
  }

  /** @deprecated use refreshByToken — institutionId no longer required */
  async refresh(institutionId: string, refreshToken: string) {
    return this.refreshByToken(refreshToken, institutionId);
  }

  /**
   * Refresh by token hash alone — the token uniquely identifies the session,
   * so the caller does not need to know the institutionId up-front. This
   * enables the httpOnly-cookie flow where the browser cannot read the cookie.
   *
   * @param token   Raw refresh token (from cookie or body)
   * @param institutionId  Optional — if provided, added as extra safety check
   */
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
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.institution.findUnique({
        where: { id: storedToken.institutionId },
        select: { name: true },
      }),
    ]);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);

    const payload = {
      sub: user.id,
      userId: user.id,
      institutionId: user.institutionId,
      roles,
      permissions,
    };

    // Sign new access token before the transaction so we don't hold a DB
    // transaction open during the async JWT operation.
    const newAccessToken = await this.jwtService.signAsync(payload);

    // Generate raw refresh token and its hash before the transaction
    const rawToken = crypto.randomBytes(64).toString('hex');
    const newTokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Revoke old token and create new one atomically — no window where both are valid
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          institutionId: user.institutionId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      });
    });

    return {
      accessToken: newAccessToken,
      refreshToken: rawToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        institutionId: user.institutionId,
        institutionName: institution?.name ?? null,
        roles,
        permissions,
      },
    };
  }

  async logout(userId: string, institutionId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        institutionId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });

    return { message: 'Logged out successfully' };
  }

  private async generateRefreshToken(userId: string, institutionId: string) {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        institutionId,
        tokenHash,
        expiresAt,
      },
    });

    return rawToken;
  }

  // ── Forgot Password ────────────────────────────────────────────────────────

  async requestPasswordReset(institutionCode: string, identifier: string) {
    const institutionId = await this.resolveInstitutionCode(institutionCode);

    // Always return the same success message regardless of whether the user exists.
    // Returning a distinct error for unknown identifiers lets an attacker enumerate
    // valid accounts by probing phone numbers / emails.
    const CONSTANT_RESPONSE = {
      message:
        'If an account with these details exists, a reset request has been submitted. Your school operator will set a new password.',
    };

    const user = await this.usersService.findByEmailOrPhone(
      institutionId,
      identifier,
    );
    if (!user) return CONSTANT_RESPONSE;

    const existing = await this.prisma.passwordResetRequest.findFirst({
      where: { institutionId, userId: user.id, status: 'pending' },
    });
    // Silently skip duplicate — same constant response so caller can't infer state.
    if (existing) return CONSTANT_RESPONSE;

    await this.prisma.passwordResetRequest.create({
      data: { institutionId, userId: user.id },
    });

    return CONSTANT_RESPONSE;
  }

  async getPendingResetRequests(institutionId: string) {
    return await this.prisma.passwordResetRequest.findMany({
      where: { institutionId, status: 'pending' },
      include: {
        user: { select: { id: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveResetRequest(institutionId: string, requestId: string) {
    const request = await this.prisma.passwordResetRequest.findFirst({
      where: { id: requestId, institutionId, status: 'pending' },
    });
    if (!request) throw new NotFoundException('Reset request not found');

    const newPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: { passwordHash },
      });
      await tx.passwordResetRequest.update({
        where: { id: requestId },
        data: { status: 'approved' },
      });
    });

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

  // ── OTP-BASED LOGIN (school management / staff) ───────────────────────────

  /**
   * Step 1: Request a login OTP.
   * Validates the institution and that the phone belongs to an active user.
   * Always returns the same constant response so an attacker cannot infer
   * whether the phone number is registered (prevents user enumeration).
   */
  async requestOtp(institutionCode: string, phone: string) {
    const RESPONSE = {
      message: 'If this number is registered, an OTP has been sent to your phone.',
    };

    let institutionId: string;
    try {
      ({ id: institutionId } = await this.resolveInstitution(institutionCode));
    } catch {
      // Don't reveal that the institution code is wrong — same constant response.
      return RESPONSE;
    }

    const user = await this.prisma.user.findFirst({
      where: { institutionId, phone, isActive: true, deletedAt: null },
      select: { id: true },
    });

    // No user found → still return constant response.
    if (!user) return RESPONSE;

    // Invalidate all previous unused OTPs for this phone+institution to prevent
    // replay of a prior unexpired OTP after a new one is requested.
    await this.prisma.otpRecord.updateMany({
      where: { institutionId, phone, purpose: 'login', isUsed: false },
      data: { isUsed: true },
    });

    // Generate a cryptographically random 6-digit OTP.
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.otpRecord.create({
      data: { institutionId, phone, purpose: 'login', otpHash, expiresAt },
    });

    await this.smsService.sendOtp(phone, otp);
    this.logger.log(`[requestOtp] OTP issued — institution=${institutionId} phone=${phone.slice(0, 5)}***`);

    return RESPONSE;
  }

  /**
   * Step 2: Verify the OTP and issue JWT tokens.
   * Tracks failed attempts per OTP record; after OTP_MAX_ATTEMPTS the record
   * is invalidated so an attacker cannot brute-force the 6-digit space.
   */
  async verifyOtp(institutionCode: string, phone: string, otp: string) {
    const INVALID = new UnauthorizedException('Invalid or expired OTP.');

    const { id: institutionId, name: institutionName } =
      await this.resolveInstitution(institutionCode);

    // Find the most-recently issued active OTP for this phone+institution.
    const record = await this.prisma.otpRecord.findFirst({
      where: {
        institutionId,
        phone,
        purpose: 'login',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw INVALID;

    // Guard: OTP already exceeded max allowed attempts — invalidate and reject.
    if (record.attemptCount >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpRecord.update({
        where: { id: record.id },
        data: { isUsed: true },
      });
      this.logger.warn(`[verifyOtp] OTP locked after ${OTP_MAX_ATTEMPTS} attempts — phone=${phone.slice(0, 5)}***`);
      throw INVALID;
    }

    // Increment attempt counter BEFORE comparing hashes so every failed guess
    // is counted even if the request is retried concurrently.
    await this.prisma.otpRecord.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
    });

    // Timing-safe hash comparison prevents timing-based OTP enumeration.
    const providedHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const storedBuf    = Buffer.from(record.otpHash, 'hex');
    const providedBuf  = Buffer.from(providedHash, 'hex');

    let isMatch = false;
    if (storedBuf.length === providedBuf.length) {
      isMatch = crypto.timingSafeEqual(storedBuf, providedBuf);
    }

    if (!isMatch) {
      this.logger.warn(`[verifyOtp] Bad OTP attempt ${record.attemptCount + 1}/${OTP_MAX_ATTEMPTS} — phone=${phone.slice(0, 5)}***`);
      throw INVALID;
    }

    // Mark OTP as consumed — single-use guarantee.
    await this.prisma.otpRecord.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    const user = await this.prisma.user.findFirst({
      where: { institutionId, phone, isActive: true, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw INVALID;

    const roles       = this.extractRoles(user.roles);
    const permissions = this.extractPermissions(user.roles);
    const payload     = { sub: user.id, userId: user.id, institutionId, roles, permissions };

    const accessToken  = await this.jwtService.signAsync(payload);
    const refreshToken = await this.generateRefreshToken(user.id, institutionId);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.logger.log(`[verifyOtp] Login success — userId=${user.id} institution=${institutionId}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        institutionId,
        institutionName,
        roles,
        permissions,
      },
    };
  }

  // ── PARENT LOGIN (password-based, no institution code) ────────────────────

  /**
   * Parent login flow: phone + password only, no school code required.
   *
   * The system automatically determines the parent's institution from their
   * phone number. Parents are never exposed to institution identifiers.
   *
   * Security notes:
   * - Constant response timing regardless of phone/password validity.
   * - If the same phone exists in multiple active institutions, login is
   *   rejected with a prompt to contact the school admin (no school details leaked).
   * - Only users with the 'parent' role are matched — staff cannot use this flow.
   */
  async parentLogin(phone: string, password: string) {
    const INVALID = new UnauthorizedException('Invalid phone number or password.');

    // Cross-institution lookup: find all parent-role users with this phone.
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

    // Filter to users in live active institutions only.
    const active = candidates.filter(
      (u) => u.institution && !u.institution.deletedAt && u.institution.status === 'active',
    );

    if (active.length === 0) {
      // Simulate bcrypt timing even when no user exists to prevent timing attacks.
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
      throw INVALID;
    }

    if (active.length > 1) {
      // Phone found in multiple schools — ambiguous, cannot auto-bind.
      // Do NOT reveal which schools exist; just ask them to contact admin.
      this.logger.warn(`[parentLogin] Ambiguous phone across ${active.length} institutions — phone=${phone.slice(0, 5)}***`);
      throw new BadRequestException(
        'Multiple school accounts found for this number. Please contact your school administrator.',
      );
    }

    const user = active[0];
    if (!user.passwordHash) {
      await bcrypt.compare(password, '$2b$12$invalidhashpadding000000000000000000000000000000000000000');
      throw INVALID;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw INVALID;

    const roles        = this.extractRoles(user.roles);
    const permissions  = this.extractPermissions(user.roles);
    const institutionId = user.institutionId;
    const payload      = { sub: user.id, userId: user.id, institutionId, roles, permissions };

    const accessToken  = await this.jwtService.signAsync(payload);
    const refreshToken = await this.generateRefreshToken(user.id, institutionId);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.logger.log(`[parentLogin] Login success — userId=${user.id} institution=${institutionId}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        institutionId,
        institutionName: user.institution.name,
        roles,
        permissions,
      },
    };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private extractRoles(userRoles: RoleWithPermissions[]): string[] {
    return userRoles.map((userRole) => userRole.role.code);
  }

  private extractPermissions(userRoles: RoleWithPermissions[]): string[] {
    const permissions = userRoles.flatMap((userRole) => {
      const rawPermissions = userRole.role.permissions;

      if (Array.isArray(rawPermissions)) {
        return rawPermissions.filter(
          (permission): permission is string => typeof permission === 'string',
        );
      }

      return [];
    });

    return [...new Set(permissions)];
  }
}