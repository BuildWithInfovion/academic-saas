import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateAcademicYearDto {
  name: string; // "2025-26"
  startDate: string; // ISO date string
  endDate: string;
  isCurrent?: boolean;
}

@Injectable()
export class AcademicService {
  constructor(private prisma: PrismaService) {}

  // ── Units (read) ───────────────────────────────────────────────────────────

  async getUnits(institutionId: string) {
    const raw = await this.prisma.academicUnit.findMany({
      where: { institutionId, deletedAt: null },
      select: {
        id: true,
        name: true,
        displayName: true,
        level: true,
        parentId: true,
        academicYearId: true,
        classTeacherUserId: true,
        classTeacher: {
          select: { id: true, email: true, phone: true },
        },
        _count: { select: { students: true } },
      },
      orderBy: { level: 'asc' },
    });
    // Deduplicate root-level units by displayName — keep the one with students
    const seen = new Map<string, typeof raw[0]>();
    for (const unit of raw) {
      if (unit.parentId !== null) { seen.set(unit.id, unit); continue; } // sections always kept as-is
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) { seen.set(key, unit); continue; }
      if (unit._count.students > existing._count.students) seen.set(key, unit);
    }
    return Array.from(seen.values());
  }

  async getLeafUnits(institutionId: string) {
    return this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        children: { none: { deletedAt: null } },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        level: true,
        parentId: true,
        academicYearId: true,
        classTeacherUserId: true,
        classTeacher: {
          select: { id: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Root-level classes only (parentId = null) — used for admission class dropdown */
  async getRootClasses(institutionId: string) {
    const raw = await this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        parentId: null,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        level: true,
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, displayName: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // Deduplicate by displayName — keep the unit with the most students
    const seen = new Map<string, typeof raw[0]>();
    for (const unit of raw) {
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing || unit._count.students > existing._count.students) seen.set(key, unit);
    }
    return Array.from(seen.values());
  }

  async getUnitById(institutionId: string, unitId: string) {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: unitId, institutionId, deletedAt: null },
      include: {
        classTeacher: {
          select: { id: true, email: true, phone: true },
        },
        parent: { select: { id: true, name: true, displayName: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, displayName: true, classTeacherUserId: true },
        },
      },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');
    return unit;
  }

  // ── Units (write) ──────────────────────────────────────────────────────────

  async createUnit(
    institutionId: string,
    dto: { name: string; displayName?: string; level: number; parentId?: string; academicYearId?: string },
  ) {
    return this.prisma.academicUnit.create({
      data: {
        institutionId,
        name: dto.name,
        displayName: dto.displayName ?? dto.name,
        level: dto.level,
        parentId: dto.parentId ?? null,
        academicYearId: dto.academicYearId ?? null,
      },
    });
  }

  async updateUnit(
    institutionId: string,
    unitId: string,
    dto: { name?: string; displayName?: string },
  ) {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: unitId, institutionId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');

    return this.prisma.academicUnit.update({
      where: { id: unitId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.displayName && { displayName: dto.displayName }),
      },
    });
  }

  async deleteUnit(institutionId: string, unitId: string) {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: unitId, institutionId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');

    // Soft-delete children first
    await this.prisma.academicUnit.updateMany({
      where: { institutionId, parentId: unitId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return this.prisma.academicUnit.update({
      where: { id: unitId },
      data: { deletedAt: new Date() },
    });
  }

  // ── Class Teacher Assignment ───────────────────────────────────────────────

  /**
   * Assign a class teacher to a leaf unit.
   * Validates that the target user is a teacher in this institution.
   * One class teacher per unit; a teacher may own multiple units if needed.
   */
  async setClassTeacher(
    institutionId: string,
    unitId: string,
    teacherUserId: string,
  ) {
    // Verify unit belongs to institution
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: unitId, institutionId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');

    // Verify teacher exists and belongs to institution
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherUserId, institutionId, deletedAt: null, isActive: true },
      include: { roles: { include: { role: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher user not found');

    // Verify user has a teacher role
    const hasTeacherRole = teacher.roles.some((ur) =>
      ['teacher', 'principal'].includes(ur.role.code),
    );
    if (!hasTeacherRole) {
      throw new BadRequestException('User does not have a teacher role');
    }

    return this.prisma.academicUnit.update({
      where: { id: unitId },
      data: { classTeacherUserId: teacherUserId },
      include: {
        classTeacher: { select: { id: true, email: true, phone: true } },
      },
    });
  }

  async removeClassTeacher(institutionId: string, unitId: string) {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: unitId, institutionId, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');

    return this.prisma.academicUnit.update({
      where: { id: unitId },
      data: { classTeacherUserId: null },
    });
  }

  /**
   * Get all class teacher assignments for the operator overview.
   * Returns leaf units with their assigned class teacher.
   */
  async getClassTeacherAssignments(institutionId: string) {
    const units = await this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        children: { none: { deletedAt: null } }, // leaf units only
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        level: true,
        parentId: true,
        classTeacherUserId: true,
        classTeacher: {
          select: { id: true, email: true, phone: true },
        },
        parent: { select: { id: true, name: true, displayName: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Deduplicate by displayName/name — keep the record with students > teacher > latest
    const seen = new Map<string, typeof units[0]>();
    for (const unit of units) {
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) { seen.set(key, unit); continue; }
      // Prefer: has students, then has teacher, then keep existing
      const unitScore = (unit._count.students > 0 ? 2 : 0) + (unit.classTeacherUserId ? 1 : 0);
      const existingScore = (existing._count.students > 0 ? 2 : 0) + (existing.classTeacherUserId ? 1 : 0);
      if (unitScore > existingScore) seen.set(key, unit);
    }

    return Array.from(seen.values());
  }

  /**
   * For a teacher: find all units where they are class teacher.
   */
  async getMyClassUnits(institutionId: string, userId: string) {
    return this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        classTeacherUserId: userId,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        level: true,
        parentId: true,
        academicYearId: true,
        parent: { select: { id: true, name: true, displayName: true } },
      },
    });
  }

  /**
   * For a teacher: all units where they are assigned as subject teacher.
   * Returns { academicUnit, subject } pairs.
   */
  async getMySubjectUnits(institutionId: string, userId: string) {
    return this.prisma.academicUnitSubject.findMany({
      where: { institutionId, teacherUserId: userId },
      select: {
        academicUnit: { select: { id: true, name: true, displayName: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Academic Years ──────────────────────────────────────────────────────────

  async getYears(institutionId: string) {
    return this.prisma.academicYear.findMany({
      where: { institutionId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createYear(institutionId: string, dto: CreateAcademicYearDto) {
    const existing = await this.prisma.academicYear.findFirst({
      where: { institutionId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Academic year "${dto.name}" already exists`);
    }

    if (dto.isCurrent) {
      await this.prisma.academicYear.updateMany({
        where: { institutionId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.academicYear.create({
      data: {
        institutionId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isCurrent: dto.isCurrent ?? false,
      },
    });
  }

  async setCurrentYear(institutionId: string, yearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, institutionId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    await this.prisma.academicYear.updateMany({
      where: { institutionId, isCurrent: true },
      data: { isCurrent: false },
    });

    return this.prisma.academicYear.update({
      where: { id: yearId },
      data: { isCurrent: true },
    });
  }

  async getCurrentYear(institutionId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { institutionId, isCurrent: true },
    });
    if (!year) {
      throw new NotFoundException('No current academic year configured');
    }
    return year;
  }
}
