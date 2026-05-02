import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
          name: dto.name?.trim() || null,
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
      where: { institutionId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true,
        isActive: true, lastLoginAt: true, totpEnabled: true, createdAt: true,
        roles: { include: { role: true } },
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
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, phone: true },
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
      select: { id: true, name: true, email: true, phone: true },
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

  async updateProfile(
    institutionId: string,
    userId: string,
    dto: { name?: string; phone?: string },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    const data: { name?: string | null; phone?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true },
    });
    return updated;
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

  async assignRole(institutionId: string, userId: string, roleId: string, callerRoles: string[] = []) {
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

    // Prevent privilege escalation: only super_admin can assign the super_admin role
    if (role.code === 'super_admin' && !callerRoles.includes('super_admin')) {
      throw new ForbiddenException('Only a Director can assign the Director role');
    }

    // Check for existing assignment before creating to return a friendly 409
    // rather than leaking a raw P2002 unique-constraint violation.
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId, institutionId },
      select: { userId: true },
    });
    if (existing) {
      throw new ConflictException('User already has this role assigned');
    }

    return this.prisma.userRole.create({
      data: { userId, roleId, institutionId },
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

  // ── Staff Profile ──────────────────────────────────────────────────────────

  async getStaffProfile(institutionId: string, userId: string) {
    return this.prisma.staffProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, roles: { include: { role: true } } } } },
    });
  }

  async upsertStaffProfile(
    institutionId: string,
    userId: string,
    dto: {
      employeeId?: string; designation?: string; department?: string;
      dateOfJoining?: string; dateOfBirth?: string; gender?: string;
      qualification?: string; experience?: string; address?: string;
      bloodGroup?: string; aadharNumber?: string; panNumber?: string;
      bankAccount?: string; ifscCode?: string; bankName?: string;
      emergencyContactName?: string; emergencyContactPhone?: string;
      photoUrl?: string; notes?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const toDate = (s?: string) => (s ? new Date(s) : null);

    return this.prisma.staffProfile.upsert({
      where: { userId },
      create: {
        institutionId, userId,
        employeeId: dto.employeeId || null,
        designation: dto.designation || null,
        department: dto.department || null,
        dateOfJoining: toDate(dto.dateOfJoining),
        dateOfBirth: toDate(dto.dateOfBirth),
        gender: dto.gender || null,
        qualification: dto.qualification || null,
        experience: dto.experience || null,
        address: dto.address || null,
        bloodGroup: dto.bloodGroup || null,
        aadharNumber: dto.aadharNumber || null,
        panNumber: dto.panNumber || null,
        bankAccount: dto.bankAccount || null,
        ifscCode: dto.ifscCode || null,
        bankName: dto.bankName || null,
        emergencyContactName: dto.emergencyContactName || null,
        emergencyContactPhone: dto.emergencyContactPhone || null,
        photoUrl: dto.photoUrl || null,
        notes: dto.notes || null,
      },
      update: {
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId || null }),
        ...(dto.designation !== undefined && { designation: dto.designation || null }),
        ...(dto.department !== undefined && { department: dto.department || null }),
        ...(dto.dateOfJoining !== undefined && { dateOfJoining: toDate(dto.dateOfJoining) }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: toDate(dto.dateOfBirth) }),
        ...(dto.gender !== undefined && { gender: dto.gender || null }),
        ...(dto.qualification !== undefined && { qualification: dto.qualification || null }),
        ...(dto.experience !== undefined && { experience: dto.experience || null }),
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup || null }),
        ...(dto.aadharNumber !== undefined && { aadharNumber: dto.aadharNumber || null }),
        ...(dto.panNumber !== undefined && { panNumber: dto.panNumber || null }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount || null }),
        ...(dto.ifscCode !== undefined && { ifscCode: dto.ifscCode || null }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName || null }),
        ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName || null }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone || null }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl || null }),
        ...(dto.notes !== undefined && { notes: dto.notes || null }),
      },
    });
  }
}
