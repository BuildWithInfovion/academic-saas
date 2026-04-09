import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardClientDto } from './dto/onboard-client.dto';

const DEFAULT_ROLES = [
  {
    code: 'super_admin',
    label: 'Director',
    permissions: [
      'users.read', 'users.write', 'users.assignRole',
      'roles.read', 'roles.write',
      'students.read', 'students.write',
      'fees.read', 'fees.write',
      'attendance.read', 'attendance.write',
      'exams.read', 'exams.write',
      'subjects.read', 'subjects.write',
      'institution.read', 'institution.write',
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
    ],
  },
  {
    code: 'principal',
    label: 'Principal',
    permissions: ['students.read', 'attendance.read', 'exams.read', 'fees.read', 'users.read', 'subjects.read'],
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

    return {
      accessToken: token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
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
    const baseCode = (dto.codeOverride || dto.name)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .substring(0, 12);

    let code = baseCode;
    let suffix = 2;
    while (await this.prisma.institution.findUnique({ where: { code } })) {
      code = baseCode.substring(0, 10) + suffix;
      suffix++;
    }

    // 2. Operator credentials
    const operatorEmail = dto.adminEmail?.trim() || `admin@${code}.in`;
    const rawPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

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

        const roles: Record<string, { id: string }> = {};
        for (const roleDef of DEFAULT_ROLES) {
          const role = await tx.role.create({
            data: {
              institutionId: inst.id,
              code: roleDef.code,
              label: roleDef.label,
              permissions: roleDef.permissions,
            },
          });
          roles[roleDef.code] = role;
        }

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

        return { institution: inst, operatorUser: operator, subscription: sub };
      });

    // 5. Seed defaults outside transaction
    await this.seedDefaults(institution.id, dto.institutionType);

    return {
      institution,
      operatorCredentials: {
        email: operatorEmail,
        phone: dto.adminPhone?.trim() || null,
        password: rawPassword,
        institutionCode: code,
      },
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
    return Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}
