import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

  async create(institutionId: string, dto: CreateUserDto) {
    if (dto.password) this.validatePasswordStrength(dto.password);

    const email = dto.email?.trim().toLowerCase() || null;
    const phone = dto.phone?.trim() || null;

    if (email) {
      const existingByEmail = await this.prisma.user.findFirst({
        where: {
          institutionId,
          deletedAt: null,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    if (phone) {
      const existingByPhone = await this.prisma.user.findFirst({
        where: { institutionId, deletedAt: null, phone },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictException('A user with this phone already exists');
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : null;

    try {
      const user = await this.prisma.user.create({
        data: {
          institutionId,
          email,
          phone,
          passwordHash,
          isActive: true,
        },
      });

      // Assign role if provided
      if (dto.role) {
        const roleRecord = await this.prisma.role.findFirst({
          where: { institutionId, code: dto.role },
        });
        if (roleRecord) {
          await this.prisma.userRole.create({
            data: { userId: user.id, roleId: roleRecord.id, institutionId },
          });
        }
      }

      return user;
    } catch (err: any) {
      if (err?.code === 'P2002')
        throw new ConflictException(
          'A user with this phone/email already exists',
        );
      throw new ConflictException('User creation failed');
    }
  }

  async findAll(institutionId: string) {
    return this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async delete(institutionId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    // Revoke all active refresh tokens so the account cannot silently refresh
    await this.prisma.refreshToken.updateMany({
      where: { userId, institutionId, isRevoked: false },
      data: { isRevoked: true },
    });

    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByRole(institutionId: string, roleCode: string) {
    return this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
        isActive: true,
        roles: { some: { role: { institutionId, code: roleCode } } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, phone: true },
    });
  }

  async findByEmail(institutionId: string, email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        institutionId,
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findByEmailOrPhone(institutionId: string, identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        institutionId,
        deletedAt: null,
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: {
        roles: { include: { role: true } },
      },
    });
  }

  /** Find a single user by phone or email — used by the link modal */
  async findByIdentifier(
    institutionId: string,
    phone?: string,
    email?: string,
  ) {
    if (!phone && !email) return [];
    const OR: any[] = [];
    if (phone) OR.push({ phone });
    if (email) OR.push({ email: { equals: email, mode: 'insensitive' } });
    return this.prisma.user.findMany({
      where: { institutionId, deletedAt: null, OR },
      select: { id: true, email: true, phone: true },
      take: 5,
    });
  }

  /** Operator-level force reset — no old password required, scoped to institution */
  async setPasswordByOperator(
    institutionId: string,
    userId: string,
    newPassword: string,
  ) {
    this.validatePasswordStrength(newPassword);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    const hash = await bcrypt.hash(newPassword, 12);
    // Revoke existing refresh tokens so old sessions are invalidated
    await this.prisma.refreshToken.updateMany({
      where: { userId, institutionId, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { message: 'Password updated' };
  }

  async changePassword(
    institutionId: string,
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    this.validatePasswordStrength(newPassword);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException('Cannot change password for this account');
    }
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid)
      throw new BadRequestException('Current password is incorrect');
    const newHash = await bcrypt.hash(newPassword, 12);
    // Revoke existing refresh tokens on password change
    await this.prisma.refreshToken.updateMany({
      where: { userId, institutionId, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
    return { message: 'Password changed successfully' };
  }

  async assignRole(institutionId: string, userId: string, roleId: string) {
    // Validate user
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        institutionId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate role
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        institutionId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Assign role
    return this.prisma.userRole.create({
      data: {
        userId,
        roleId,
        institutionId,
      },
    });
  }

  /** Returns class-teacher and subject-teacher assignments for a staff member */
  async getAssignments(institutionId: string, userId: string) {
    const [classTeacherOf, subjectTeaching] = await Promise.all([
      this.prisma.academicUnit.findMany({
        where: { institutionId, classTeacherUserId: userId, deletedAt: null },
        select: { id: true, name: true, displayName: true, level: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.academicUnitSubject.findMany({
        where: { institutionId, teacherUserId: userId },
        select: {
          academicUnit: { select: { id: true, name: true, displayName: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { classTeacherOf, subjectTeaching };
  }
}
