import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt'; // <-- KEEP ONLY THIS ONE
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type RoleWithPermissions = {
  role: {
    code: string;
    permissions: unknown;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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

  async refresh(institutionId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        institutionId,
        isRevoked: false,
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: storedToken.userId,
        institutionId,
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
    });

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
    const user = await this.usersService.findByEmailOrPhone(
      institutionId,
      identifier,
    );
    if (!user) {
      throw new NotFoundException('No account found with these credentials');
    }

    const existing = await this.prisma.passwordResetRequest.findFirst({
      where: { institutionId, userId: user.id, status: 'pending' },
    });
    if (existing) {
      throw new BadRequestException(
        'A reset request is already pending. Please contact your school operator.',
      );
    }

    await this.prisma.passwordResetRequest.create({
      data: { institutionId, userId: user.id },
    });

    return {
      message:
        'Reset request submitted. The school operator will set a new password for you.',
    };
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

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
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