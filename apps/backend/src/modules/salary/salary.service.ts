import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

const STAFF_ROLE_CODES = ['super_admin', 'admin', 'principal', 'teacher', 'receptionist', 'non_teaching_staff', 'accountant'];
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSalaryStructureDto, UpdateSalaryStructureDto,
  AssignSalaryProfileDto, UpdateSalaryProfileDto,
  GenerateSalaryDto, UpdateSalaryStatusDto,
  AllowanceItemDto,
} from './dto/salary.dto';

function toJson(items: AllowanceItemDto[] | undefined | null): Prisma.InputJsonValue {
  return (items ?? []) as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  // ── Salary Structures ──────────────────────────────────────────────────────

  async getStructures(institutionId: string) {
    return this.prisma.salaryStructure.findMany({
      where: { institutionId },
      include: { _count: { select: { staffProfiles: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createStructure(institutionId: string, dto: CreateSalaryStructureDto) {
    try {
      return await this.prisma.salaryStructure.create({
        data: {
          institutionId,
          name: dto.name,
          description: dto.description,
          basicSalary: dto.basicSalary,
          houseRentAllowance: dto.houseRentAllowance ?? 0,
          medicalAllowance: dto.medicalAllowance ?? 0,
          transportAllowance: dto.transportAllowance ?? 0,
          otherAllowances: toJson(dto.otherAllowances),
          providentFund: dto.providentFund ?? 0,
          professionalTax: dto.professionalTax ?? 0,
          otherDeductions: toJson(dto.otherDeductions),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A salary structure with this name already exists');
      throw e;
    }
  }

  async updateStructure(institutionId: string, id: string, dto: UpdateSalaryStructureDto) {
    const existing = await this.prisma.salaryStructure.findFirst({ where: { id, institutionId } });
    if (!existing) throw new NotFoundException('Salary structure not found');
    try {
      return await this.prisma.salaryStructure.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.basicSalary !== undefined && { basicSalary: dto.basicSalary }),
          ...(dto.houseRentAllowance !== undefined && { houseRentAllowance: dto.houseRentAllowance }),
          ...(dto.medicalAllowance !== undefined && { medicalAllowance: dto.medicalAllowance }),
          ...(dto.transportAllowance !== undefined && { transportAllowance: dto.transportAllowance }),
          ...(dto.otherAllowances !== undefined && { otherAllowances: toJson(dto.otherAllowances) }),
          ...(dto.providentFund !== undefined && { providentFund: dto.providentFund }),
          ...(dto.professionalTax !== undefined && { professionalTax: dto.professionalTax }),
          ...(dto.otherDeductions !== undefined && { otherDeductions: toJson(dto.otherDeductions) }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A salary structure with this name already exists');
      throw e;
    }
  }

  async deleteStructure(institutionId: string, id: string) {
    const existing = await this.prisma.salaryStructure.findFirst({ where: { id, institutionId } });
    if (!existing) throw new NotFoundException('Salary structure not found');
    const linked = await this.prisma.staffSalaryProfile.count({ where: { structureId: id } });
    if (linked > 0) throw new BadRequestException('Cannot delete — structure is linked to staff profiles');
    return this.prisma.salaryStructure.delete({ where: { id } });
  }

  // ── Staff Salary Profiles ──────────────────────────────────────────────────

  async getProfiles(institutionId: string) {
    return this.prisma.staffSalaryProfile.findMany({
      where: { institutionId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, roles: { include: { role: true } } } },
        structure: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProfile(institutionId: string, userId: string) {
    const profile = await this.prisma.staffSalaryProfile.findFirst({
      where: { institutionId, userId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, roles: { include: { role: true } } } },
        structure: { select: { id: true, name: true } },
      },
    });
    if (!profile) throw new NotFoundException('No salary profile found for this staff member');
    return profile;
  }

  async assignProfile(institutionId: string, actorUserId: string, dto: AssignSalaryProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, institutionId, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Staff member not found');

    const isStaff = user.roles.some((ur) => STAFF_ROLE_CODES.includes(ur.role.code));
    if (!isStaff) throw new BadRequestException('Salary profiles can only be assigned to staff members, not parents or students');

    if (dto.structureId) {
      const structure = await this.prisma.salaryStructure.findFirst({ where: { id: dto.structureId, institutionId } });
      if (!structure) throw new NotFoundException('Salary structure not found');
    }

    const existing = await this.prisma.staffSalaryProfile.findUnique({ where: { userId: dto.userId } });

    if (existing) {
      return this.prisma.staffSalaryProfile.update({
        where: { userId: dto.userId },
        data: {
          structureId: dto.structureId ?? null,
          basicSalary: dto.basicSalary,
          houseRentAllowance: dto.houseRentAllowance ?? 0,
          medicalAllowance: dto.medicalAllowance ?? 0,
          transportAllowance: dto.transportAllowance ?? 0,
          otherAllowances: toJson(dto.otherAllowances),
          providentFund: dto.providentFund ?? 0,
          professionalTax: dto.professionalTax ?? 0,
          otherDeductions: toJson(dto.otherDeductions),
          effectiveFrom: new Date(dto.effectiveFrom),
          notes: dto.notes,
          isActive: true,
        },
      });
    }

    return this.prisma.staffSalaryProfile.create({
      data: {
        institutionId,
        userId: dto.userId,
        structureId: dto.structureId ?? null,
        basicSalary: dto.basicSalary,
        houseRentAllowance: dto.houseRentAllowance ?? 0,
        medicalAllowance: dto.medicalAllowance ?? 0,
        transportAllowance: dto.transportAllowance ?? 0,
        otherAllowances: toJson(dto.otherAllowances),
        providentFund: dto.providentFund ?? 0,
        professionalTax: dto.professionalTax ?? 0,
        otherDeductions: toJson(dto.otherDeductions),
        effectiveFrom: new Date(dto.effectiveFrom),
        notes: dto.notes,
      },
    });
  }

  async updateProfile(institutionId: string, profileId: string, dto: UpdateSalaryProfileDto) {
    const profile = await this.prisma.staffSalaryProfile.findFirst({ where: { id: profileId, institutionId } });
    if (!profile) throw new NotFoundException('Salary profile not found');

    if (dto.structureId) {
      const structure = await this.prisma.salaryStructure.findFirst({ where: { id: dto.structureId, institutionId } });
      if (!structure) throw new NotFoundException('Salary structure not found');
    }

    return this.prisma.staffSalaryProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.structureId !== undefined && { structureId: dto.structureId || null }),
        ...(dto.basicSalary !== undefined && { basicSalary: dto.basicSalary }),
        ...(dto.houseRentAllowance !== undefined && { houseRentAllowance: dto.houseRentAllowance }),
        ...(dto.medicalAllowance !== undefined && { medicalAllowance: dto.medicalAllowance }),
        ...(dto.transportAllowance !== undefined && { transportAllowance: dto.transportAllowance }),
        ...(dto.otherAllowances !== undefined && { otherAllowances: toJson(dto.otherAllowances) }),
        ...(dto.providentFund !== undefined && { providentFund: dto.providentFund }),
        ...(dto.professionalTax !== undefined && { professionalTax: dto.professionalTax }),
        ...(dto.otherDeductions !== undefined && { otherDeductions: toJson(dto.otherDeductions) }),
        ...(dto.effectiveFrom !== undefined && { effectiveFrom: new Date(dto.effectiveFrom) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── Salary Generation ──────────────────────────────────────────────────────

  async generateMonthly(institutionId: string, actorUserId: string, dto: GenerateSalaryDto) {
    const { month, year } = dto;

    const profiles = await this.prisma.staffSalaryProfile.findMany({
      where: { institutionId, isActive: true },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (profiles.length === 0) throw new BadRequestException('No active salary profiles found');

    const results = { created: 0, skipped: 0, total: profiles.length };

    for (const profile of profiles) {
      const existing = await this.prisma.salaryRecord.findUnique({
        where: { institutionId_userId_month_year: { institutionId, userId: profile.userId, month, year } },
      });
      if (existing) { results.skipped++; continue; }

      const otherAllowancesArr = (profile.otherAllowances as { name: string; amount: number }[] | null) ?? [];
      const otherDeductionsArr = (profile.otherDeductions as { name: string; amount: number }[] | null) ?? [];
      const otherAllowancesTotal = otherAllowancesArr.reduce((s, a) => s + a.amount, 0);
      const otherDeductionsTotal = otherDeductionsArr.reduce((s, d) => s + d.amount, 0);

      const grossSalary =
        profile.basicSalary +
        profile.houseRentAllowance +
        profile.medicalAllowance +
        profile.transportAllowance +
        otherAllowancesTotal;

      const totalDeductions =
        profile.providentFund +
        profile.professionalTax +
        otherDeductionsTotal;

      const netSalary = grossSalary - totalDeductions;

      await this.prisma.salaryRecord.create({
        data: {
          institutionId,
          userId: profile.userId,
          profileId: profile.id,
          month,
          year,
          basicSalary: profile.basicSalary,
          houseRentAllowance: profile.houseRentAllowance,
          medicalAllowance: profile.medicalAllowance,
          transportAllowance: profile.transportAllowance,
          otherAllowances: (profile.otherAllowances ?? []) as unknown as Prisma.InputJsonValue,
          grossSalary,
          providentFund: profile.providentFund,
          professionalTax: profile.professionalTax,
          otherDeductions: (profile.otherDeductions ?? []) as unknown as Prisma.InputJsonValue,
          totalDeductions,
          netSalary,
          status: 'pending',
        },
      });
      results.created++;
    }

    return results;
  }

  // ── Salary Records ─────────────────────────────────────────────────────────

  async getRecords(institutionId: string, month?: number, year?: number, status?: string) {
    return this.prisma.salaryRecord.findMany({
      where: {
        institutionId,
        ...(month !== undefined && { month }),
        ...(year !== undefined && { year }),
        ...(status && { status }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, roles: { include: { role: true } } } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { user: { name: 'asc' } }],
    });
  }

  async getRecord(institutionId: string, id: string) {
    const record = await this.prisma.salaryRecord.findFirst({
      where: { id, institutionId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, roles: { include: { role: true } } } },
        profile: true,
      },
    });
    if (!record) throw new NotFoundException('Salary record not found');
    return record;
  }

  async updateRecordStatus(institutionId: string, id: string, actorUserId: string, dto: UpdateSalaryStatusDto) {
    const record = await this.prisma.salaryRecord.findFirst({ where: { id, institutionId } });
    if (!record) throw new NotFoundException('Salary record not found');

    return this.prisma.salaryRecord.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'paid' && {
          paidOn: dto.paidOn ? new Date(dto.paidOn) : new Date(),
          paymentMode: dto.paymentMode,
          paymentReference: dto.paymentReference,
          markedPaidById: actorUserId,
        }),
        ...(dto.remarks !== undefined && { remarks: dto.remarks }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getStaffHistory(institutionId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, institutionId } });
    if (!user) throw new NotFoundException('Staff member not found');

    const [profile, records] = await Promise.all([
      this.prisma.staffSalaryProfile.findFirst({
        where: { institutionId, userId },
        include: { structure: { select: { id: true, name: true } } },
      }),
      this.prisma.salaryRecord.findMany({
        where: { institutionId, userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    ]);

    return { user, profile, records };
  }

  async getMonthlySummary(institutionId: string, month: number, year: number) {
    const records = await this.prisma.salaryRecord.findMany({
      where: { institutionId, month, year },
    });

    const total = records.length;
    const paid = records.filter((r) => r.status === 'paid').length;
    const pending = records.filter((r) => r.status === 'pending').length;
    const onHold = records.filter((r) => r.status === 'on_hold').length;
    const totalNetSalary = records.reduce((s, r) => s + r.netSalary, 0);
    const paidAmount = records.filter((r) => r.status === 'paid').reduce((s, r) => s + r.netSalary, 0);
    const pendingAmount = records.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.netSalary, 0);

    return { month, year, total, paid, pending, onHold, totalNetSalary, paidAmount, pendingAmount };
  }

  async getStaffWithoutProfile(institutionId: string) {
    const profiledUserIds = await this.prisma.staffSalaryProfile.findMany({
      where: { institutionId },
      select: { userId: true },
    });
    const ids = profiledUserIds.map((p) => p.userId);

    return this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
        id: { notIn: ids },
        roles: { some: { role: { code: { in: STAFF_ROLE_CODES } } } },
      },
      select: { id: true, name: true, email: true, phone: true, roles: { include: { role: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
