import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardClientDto } from './dto/onboard-client.dto';

const DEFAULT_ROLES = [
  {
    // Director: read-only monitoring — can see everything, cannot modify
    code: 'super_admin',
    label: 'Director',
    permissions: [
      'users.read', 'roles.read',
      'students.read',
      'fees.read',
      'attendance.read',
      'exams.read',
      'subjects.read',
      'institution.read',
      'academic.read',
    ],
  },
  {
    code: 'admin',
    label: 'Operator',
    permissions: [
      'users.read', 'users.write', 'users.assignRole',
      'roles.read',
      'students.read', 'students.write',
      'fees.read', 'fees.write',
      'attendance.read', 'attendance.write',
      'exams.read', 'exams.write',
      'subjects.read', 'subjects.write',
      'academic.read', 'academic.write',
      'institution.read', 'institution.write',
    ],
  },
  {
    // Principal: full school administration — academic, fees, institution, staff
    code: 'principal',
    label: 'Principal',
    permissions: [
      'students.read',
      'attendance.read', 'attendance.write',
      'exams.read',
      'fees.read', 'fees.write',
      'users.read', 'users.write',
      'subjects.read', 'subjects.write',
      'academic.read', 'academic.write',
      'institution.read', 'institution.write',
    ],
  },
  {
    code: 'teacher',
    label: 'Teacher',
    permissions: ['attendance.read', 'attendance.write', 'exams.read', 'exams.write', 'subjects.read', 'students.read'],
  },
  {
    code: 'student',
    label: 'Student',
    permissions: ['attendance.read', 'exams.read', 'fees.read'],
  },
  {
    code: 'parent',
    label: 'Parent',
    permissions: ['attendance.read', 'exams.read', 'fees.read'],
  },
  {
    code: 'receptionist',
    label: 'Desk / Reception',
    permissions: ['inquiry.read', 'inquiry.write', 'students.read', 'users.read'],
  },
  {
    // Accountant: fee management + student viewing
    code: 'accountant',
    label: 'Accountant',
    permissions: [
      'fees.read', 'fees.write',
      'students.read',
      'attendance.read',
      'institution.read',
      'subjects.read',
    ],
  },
  {
    // Non-Teaching Staff: self attendance + announcements only
    code: 'non_teaching_staff',
    label: 'Non-Teaching Staff',
    permissions: ['attendance.read'],
  },
];

const SCHOOL_CLASSES = [
  { name: 'lkg',      displayName: 'LKG' },
  { name: 'ukg',      displayName: 'UKG' },
  { name: 'kg',       displayName: 'KG' },
  { name: 'class_1',  displayName: 'Class 1' },
  { name: 'class_2',  displayName: 'Class 2' },
  { name: 'class_3',  displayName: 'Class 3' },
  { name: 'class_4',  displayName: 'Class 4' },
  { name: 'class_5',  displayName: 'Class 5' },
  { name: 'class_6',  displayName: 'Class 6' },
  { name: 'class_7',  displayName: 'Class 7' },
  { name: 'class_8',  displayName: 'Class 8' },
  { name: 'class_9',  displayName: 'Class 9' },
  { name: 'class_10', displayName: 'Class 10' },
  { name: 'class_11', displayName: 'Class 11' },
  { name: 'class_12', displayName: 'Class 12' },
];

const DEFAULT_FEE_HEADS = [
  'Tuition Fee', 'Exam Fee', 'Library Fee', 'Lab Fee', 'Sports Fee',
  'Activity Fee', 'Development Fee', 'Admission Fee', 'Transport Fee', 'Hostel Fee',
];

const SCHOOL_SUBJECTS = [
  'English', 'Hindi', 'Mathematics', 'Environmental Studies', 'General Knowledge',
  'Science', 'Social Studies', 'Sanskrit', 'Marathi', 'Drawing & Craft',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography',
  'Political Science', 'Economics', 'Computer Science', 'Accountancy',
  'Business Studies', 'Information Technology', 'Physical Education',
];

const COLLEGE_SUBJECTS = [
  'English Communication', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Computer Applications', 'Statistics', 'Economics', 'Commerce', 'Management',
  'Environmental Studies', 'Soft Skills',
];

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Hard limit: only MAX_PLATFORM_ADMINS active accounts may ever exist.
  // The portal is an internal dev tool; two seats cover all real use cases.
  private static readonly MAX_PLATFORM_ADMINS = 2;

  // ── AUTH ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Enforce max-seat policy: count ALL active admins. If somehow > limit,
    // block login so access is self-healing without a DB migration.
    const activeCount = await this.prisma.platformAdmin.count({
      where: { isActive: true },
    });
    if (activeCount > PlatformService.MAX_PLATFORM_ADMINS) {
      throw new ForbiddenException(
        `Access restricted to ${PlatformService.MAX_PLATFORM_ADMINS} accounts. Contact the system owner.`,
      );
    }

    const payload = {
      sub: admin.id,
      type: 'platform_admin',
      email: admin.email,
      name: admin.name,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '24h',
    });

    // Non-blocking: track last login time for profile display.
    this.prisma.platformAdmin
      .update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {/* ignore, not critical */});

    return {
      accessToken: token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, lastLoginAt: true, createdAt: true },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');
    return admin;
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
    });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Account not found');

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    // Prevent reuse of the same password
    const same = await bcrypt.compare(newPassword, admin.passwordHash);
    if (same) throw new BadRequestException('New password must differ from current password');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: { passwordHash },
    });

    return { message: 'Password updated successfully' };
  }

  // ── STATS ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [total, subscriptions] = await Promise.all([
      this.prisma.institution.count({ where: { deletedAt: null } }),
      this.prisma.subscription.findMany({
        where: { institution: { deletedAt: null } },
        select: { status: true, endDate: true, totalAmount: true, amountPaid: true },
      }),
    ]);

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let totalRevenue = 0;
    let pendingRevenue = 0;

    for (const sub of subscriptions) {
      totalRevenue += sub.totalAmount;
      pendingRevenue += sub.totalAmount - (sub.amountPaid ?? 0);

      if (sub.endDate < now) {
        expired++;
      } else if (sub.endDate <= thirtyDaysLater) {
        expiringSoon++;
        active++;
      } else {
        active++;
      }
    }

    return { total, active, expiringSoon, expired, totalRevenue, pendingRevenue };
  }

  // ── CLIENTS ───────────────────────────────────────────────────────────────

  async getClients() {
    return this.prisma.institution.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
        _count: {
          select: {
            students: { where: { deletedAt: null, status: 'active' } },
            users: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  async getClientDetail(institutionId: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        subscription: true,
        _count: {
          select: {
            students: { where: { deletedAt: null } },
            users: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!institution) throw new NotFoundException('Client not found');
    return institution;
  }

  async updateClientStatus(institutionId: string, status: string) {
    const allowed = ['active', 'inactive', 'suspended'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Status must be one of: ${allowed.join(', ')}`);
    }

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { status },
    });
  }

  async upsertSubscription(
    institutionId: string,
    dto: {
      planName?: string;
      maxStudents?: number;
      pricePerUser?: number;
      billingCycleYears?: number;
      startDate?: string;
      endDate?: string;
      amountPaid?: number;
      paidAt?: string;
      notes?: string;
    },
  ) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) throw new NotFoundException('Client not found');

    const existing = await this.prisma.subscription.findUnique({
      where: { institutionId },
    });

    const maxStudents = dto.maxStudents ?? existing?.maxStudents ?? 500;
    const pricePerUser = dto.pricePerUser ?? existing?.pricePerUser ?? 50;
    const billingCycleYears = dto.billingCycleYears ?? existing?.billingCycleYears ?? 1;
    const totalAmount = maxStudents * pricePerUser;
    const startDate = dto.startDate ? new Date(dto.startDate) : (existing?.startDate ?? new Date());
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : (() => {
          const d = new Date(startDate);
          d.setFullYear(d.getFullYear() + billingCycleYears);
          return d;
        })();

    const now = new Date();
    const status = endDate < now ? 'expired' : 'active';

    return this.prisma.subscription.upsert({
      where: { institutionId },
      create: {
        institutionId,
        planName: dto.planName ?? 'standard',
        maxStudents,
        pricePerUser,
        billingCycleYears,
        totalAmount,
        startDate,
        endDate,
        status,
        amountPaid: dto.amountPaid,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
      update: {
        planName: dto.planName ?? existing?.planName,
        maxStudents,
        pricePerUser,
        billingCycleYears,
        totalAmount,
        startDate,
        endDate,
        status,
        amountPaid: dto.amountPaid,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
      },
    });
  }

  async removeClient(institutionId: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) throw new NotFoundException('Client not found');

    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
  }

  // ── ONBOARD ───────────────────────────────────────────────────────────────

  async onboardClient(dto: OnboardClientDto) {
    // 1. Generate institution code
    const baseCode = this.buildInstitutionCode(dto.codeOverride, dto.name);

    let code = baseCode;
    let suffix = 2;
    while (await this.prisma.institution.findUnique({ where: { code } })) {
      code = `${baseCode.substring(0, Math.max(1, 12 - String(suffix).length))}${suffix}`;
      suffix++;
    }

    // 2. Operator credentials
    const operatorEmail = dto.adminEmail || `admin@${code}.in`;
    const rawPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // 2b. Director credentials (optional — only if directorEmail/Phone provided)
    const hasDirector = !!(dto.directorEmail || dto.directorPhone);
    const directorEmail = dto.directorEmail || (hasDirector ? `director@${code}.in` : null);
    const rawDirectorPassword = hasDirector ? this.generatePassword() : null;
    const directorPasswordHash = rawDirectorPassword
      ? await bcrypt.hash(rawDirectorPassword, 12)
      : null;

    // 3. Subscription dates
    const startDate = dto.subscriptionStartDate
      ? new Date(dto.subscriptionStartDate)
      : new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + (dto.subscriptionYears ?? 1));

    const maxStudents = dto.maxStudents;
    const pricePerUser = dto.pricePerUser ?? 50;
    const totalAmount = maxStudents * pricePerUser;

    // 4. Transaction: institution + roles + operator + subscription
    // timeout=60s: 27 sequential ops over remote DB (roles loop + classes loop) easily
    // exceed Prisma's 5 s default. maxWait=10s covers connection-pool wait.
    const { institution, operatorUser, subscription } =
      await this.prisma.$transaction(async (tx) => {
        const inst = await tx.institution.create({
          data: {
            name: dto.name,
            code,
            planCode: dto.planCode,
            institutionType: dto.institutionType,
            status: 'active',
          },
        });

        await tx.role.createMany({
          data: DEFAULT_ROLES.map((r) => ({
            institutionId: inst.id,
            code: r.code,
            label: r.label,
            permissions: r.permissions,
          })),
        });
        const roleRows = await tx.role.findMany({
          where: { institutionId: inst.id },
          select: { id: true, code: true },
        });
        const roles: Record<string, { id: string }> = Object.fromEntries(
          roleRows.map((r) => [r.code, { id: r.id }]),
        );

        const operator = await tx.user.create({
          data: {
            institutionId: inst.id,
            email: operatorEmail,
            phone: dto.adminPhone?.trim() || null,
            passwordHash,
            isActive: true,
          },
        });

        await tx.userRole.create({
          data: {
            userId: operator.id,
            roleId: roles['admin'].id,
            institutionId: inst.id,
          },
        });

        // Create Director (super_admin) if details were provided
        let directorUser: { id: string } | null = null;
        if (hasDirector && directorEmail && directorPasswordHash) {
          directorUser = await tx.user.create({
            data: {
              institutionId: inst.id,
              email: directorEmail,
              phone: dto.directorPhone?.trim() || null,
              passwordHash: directorPasswordHash,
              isActive: true,
            },
          });
          await tx.userRole.create({
            data: {
              userId: directorUser.id,
              roleId: roles['super_admin'].id,
              institutionId: inst.id,
            },
          });
        }

        const sub = await tx.subscription.create({
          data: {
            institutionId: inst.id,
            planName: dto.planCode,
            maxStudents,
            pricePerUser,
            billingCycleYears: dto.subscriptionYears ?? 1,
            totalAmount,
            startDate,
            endDate,
            status: 'active',
            notes: dto.notes,
          },
        });

        // Seed academic year + classes (school only; college gets custom setup)
        // Academic year: June–March straddle. If subscription starts Apr–May it's
        // still the current session (e.g. Apr 2026 → "2025-26").
        const ayStartMonth = startDate.getMonth(); // 0-indexed
        const ayStartYear  = ayStartMonth >= 5     // >= June
          ? startDate.getFullYear()
          : startDate.getFullYear() - 1;
        const ayName  = `${ayStartYear}-${String(ayStartYear + 1).slice(2)}`;
        const ayStart = new Date(`${ayStartYear}-06-01`);
        const ayEnd   = new Date(`${ayStartYear + 1}-03-31`);

        const academicYear = await tx.academicYear.create({
          data: {
            institutionId: inst.id,
            name: ayName,
            startDate: ayStart,
            endDate: ayEnd,
            isCurrent: true,
          },
        });

        if (dto.institutionType === 'school') {
          await tx.academicUnit.createMany({
            data: SCHOOL_CLASSES.map((cls) => ({
              institutionId:  inst.id,
              academicYearId: academicYear.id,
              name:           cls.name,
              displayName:    cls.displayName,
              level:          1,
              parentId:       null,
            })),
          });
        }

        return { institution: inst, operatorUser: operator, directorUser, subscription: sub };
      }, { timeout: 60000, maxWait: 10000 });

    // 5. Seed defaults outside transaction
    await this.seedDefaults(institution.id, dto.institutionType);

    return {
      institution,
      operatorCredentials: {
        email: operatorEmail,
        phone: dto.adminPhone || null,
        password: rawPassword,
        institutionCode: code,
      },
      directorCredentials: hasDirector
        ? {
            email: directorEmail,
            phone: dto.directorPhone || null,
            password: rawDirectorPassword,
            institutionCode: code,
          }
        : null,
      subscription,
    };
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  private async seedDefaults(institutionId: string, institutionType: string) {
    const subjectList = institutionType === 'college' ? COLLEGE_SUBJECTS : SCHOOL_SUBJECTS;

    const feeOps = DEFAULT_FEE_HEADS.map((name) =>
      this.prisma.feeHead.upsert({
        where: { institutionId_name: { institutionId, name } },
        create: { institutionId, name, isCustom: false },
        update: {},
      }),
    );
    const subOps = subjectList.map((name) =>
      this.prisma.subject.upsert({
        where: { institutionId_name: { institutionId, name } },
        create: { institutionId, name },
        update: {},
      }),
    );

    await Promise.all([
      this.prisma.$transaction(feeOps),
      this.prisma.$transaction(subOps),
    ]);
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    // Use crypto.randomBytes for cryptographically secure randomness.
    // Math.random() is not CSPRNG and its output can be predicted.
    return Array.from(
      crypto.randomBytes(10),
      (byte) => chars[byte % chars.length],
    ).join('');
  }

  private buildInstitutionCode(codeOverride: string | undefined, institutionName: string): string {
    const source = codeOverride || institutionName;
    const normalized = source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    const compact = normalized.replace(/-/g, '');
    const code = (compact || 'inst').substring(0, 12);

    if (!code) {
      throw new BadRequestException('Unable to generate a valid institution code');
    }

    return code;
  }
}
