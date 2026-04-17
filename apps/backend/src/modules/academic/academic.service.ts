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

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAcademicYearLabel(startYear: number, endYear: number): string {
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/** Natural numeric sort — "Class 2" < "Class 10", "LKG" < "UKG" < "Class 1" */
function naturalLabel(unit: {
  name: string;
  displayName?: string | null;
}): string {
  return (unit.displayName || unit.name).toLowerCase();
}

const FIXED_ORDER = ['lkg', 'ukg', 'kg', 'nursery', 'pp1', 'pp2'];

function naturalSort<T extends { name: string; displayName?: string | null }>(
  arr: T[],
): T[] {
  return [...arr].sort((a, b) => {
    const la = naturalLabel(a);
    const lb = naturalLabel(b);
    const ai = FIXED_ORDER.findIndex((k) => la.includes(k));
    const bi = FIXED_ORDER.findIndex((k) => lb.includes(k));
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return la.localeCompare(lb, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
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
    const seen = new Map<string, (typeof raw)[0]>();
    for (const unit of raw) {
      if (unit.parentId !== null) {
        seen.set(unit.id, unit);
        continue;
      } // sections always kept as-is
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, unit);
        continue;
      }
      if (unit._count.students > existing._count.students) seen.set(key, unit);
    }
    return naturalSort(Array.from(seen.values()));
  }

  async getLeafUnits(institutionId: string) {
    const raw = await this.prisma.academicUnit.findMany({
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
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Deduplicate by displayName — keep the unit with most students
    // (guards against duplicate units from multiple seed runs)
    const seen = new Map<string, (typeof raw)[0]>();
    for (const unit of raw) {
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, unit);
        continue;
      }
      // Prefer: has students, then has classTeacher, then keep existing
      const score = (u: (typeof raw)[0]) =>
        (u._count.students > 0 ? 2 : 0) + (u.classTeacherUserId ? 1 : 0);
      if (score(unit) > score(existing)) seen.set(key, unit);
    }
    return naturalSort(Array.from(seen.values()));
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
    const seen = new Map<string, (typeof raw)[0]>();
    for (const unit of raw) {
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing || unit._count.students > existing._count.students)
        seen.set(key, unit);
    }
    return naturalSort(Array.from(seen.values()));
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
          select: {
            id: true,
            name: true,
            displayName: true,
            classTeacherUserId: true,
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Academic unit not found');
    return unit;
  }

  // ── Units (write) ──────────────────────────────────────────────────────────

  async createUnit(
    institutionId: string,
    dto: {
      name: string;
      displayName?: string;
      level: number;
      parentId?: string;
      academicYearId?: string;
    },
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
      where: {
        id: teacherUserId,
        institutionId,
        deletedAt: null,
        isActive: true,
      },
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
      orderBy: { createdAt: 'asc' },
    });

    // Deduplicate by displayName/name — keep the record with students > teacher > latest
    const seen = new Map<string, (typeof units)[0]>();
    for (const unit of units) {
      const key = (unit.displayName || unit.name).toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, unit);
        continue;
      }
      // Prefer: has students, then has teacher, then keep existing
      const unitScore =
        (unit._count.students > 0 ? 2 : 0) + (unit.classTeacherUserId ? 1 : 0);
      const existingScore =
        (existing._count.students > 0 ? 2 : 0) +
        (existing.classTeacherUserId ? 1 : 0);
      if (unitScore > existingScore) seen.set(key, unit);
    }

    return naturalSort(Array.from(seen.values()));
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

  // ── Institution profile ────────────────────────────────────────────────────

  async getInstitution(institutionId: string) {
    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, code: true, board: true, address: true, phone: true, email: true },
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
    const name = dto.name.trim();
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);

    if (!/^\d{4}-\d{2}$/.test(name)) {
      throw new BadRequestException('Enter a valid year value like 2026-27');
    }
    if (!startDate || !endDate) {
      throw new BadRequestException('Enter valid start and end dates');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const expectedName = formatAcademicYearLabel(
      startDate.getUTCFullYear(),
      endDate.getUTCFullYear(),
    );
    if (name !== expectedName) {
      throw new BadRequestException(
        `Year name must match the selected dates, for example ${expectedName}`,
      );
    }

    const existing = await this.prisma.academicYear.findFirst({
      where: { institutionId, name },
    });
    if (existing) {
      throw new ConflictException(`Academic year "${name}" already exists`);
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
        name,
        startDate,
        endDate,
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

  // ── Year-End Transition ────────────────────────────────────────────────────

  /**
   * Returns all leaf classes with per-status student counts.
   * Used by the operator to review readiness before running the transition.
   */
  async getTransitionOverview(institutionId: string) {
    const units = await this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        children: { none: { deletedAt: null } },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        parentId: true,
        classTeacherUserId: true,
        classTeacher: { select: { id: true, email: true, phone: true } },
        parent: { select: { id: true, name: true, displayName: true } },
        students: {
          where: { deletedAt: null, status: { in: ['active', 'held_back'] } },
          select: { status: true },
        },
      },
    });

    const deduped = new Map<string, (typeof units)[0]>();
    for (const u of units) {
      const key = (u.displayName || u.name).toLowerCase().trim();
      const ex = deduped.get(key);
      if (!ex) { deduped.set(key, u); continue; }
      const score = (x: typeof u) =>
        (x.students.length > 0 ? 2 : 0) + (x.classTeacherUserId ? 1 : 0);
      if (score(u) > score(ex)) deduped.set(key, u);
    }

    return naturalSort(Array.from(deduped.values())).map((u) => ({
      id: u.id,
      name: u.name,
      displayName: u.displayName,
      parent: u.parent,
      classTeacher: u.classTeacher,
      hasTeacher: !!u.classTeacherUserId,
      totalStudents: u.students.length,
      activeStudents: u.students.filter((s) => s.status === 'active').length,
      heldBackStudents: u.students.filter((s) => s.status === 'held_back').length,
    }));
  }

  /**
   * Suggests a class progression map based on natural sort order.
   * Each class maps to the next class; the last class maps to null (graduate).
   *
   * Uses the same score-based deduplication as getTransitionOverview so that
   * the sourceUnitIds in the suggestion always match the IDs in the overview.
   */
  async getClassMapSuggestion(institutionId: string) {
    const units = await this.prisma.academicUnit.findMany({
      where: {
        institutionId,
        deletedAt: null,
        children: { none: { deletedAt: null } },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        parentId: true,
        classTeacherUserId: true,
        _count: { select: { students: true } },
      },
    });

    // Mirror the deduplication from getTransitionOverview: prefer the unit with
    // the most students, then the one with a class teacher assigned.
    const deduped = new Map<string, (typeof units)[0]>();
    for (const u of units) {
      const key = (u.displayName || u.name).toLowerCase().trim();
      const ex = deduped.get(key);
      if (!ex) { deduped.set(key, u); continue; }
      const score = (x: typeof u) =>
        (x._count.students > 0 ? 2 : 0) + (x.classTeacherUserId ? 1 : 0);
      if (score(u) > score(ex)) deduped.set(key, u);
    }

    const sorted = naturalSort(Array.from(deduped.values()));
    return sorted.map((unit, idx) => ({
      sourceUnit: { id: unit.id, name: unit.name, displayName: unit.displayName },
      suggestedTargetUnitId: idx + 1 < sorted.length ? sorted[idx + 1].id : null,
    }));
  }

  /**
   * Executes the year-end student transition atomically.
   *
   * Rules applied per class:
   *   - active   + targetUnitId  → promoted to target class with new roll numbers
   *   - active   + null target   → graduated (status='graduated', academicUnitId=null)
   *   - held_back               → status reset to 'active', stays in same class (repeating year)
   *
   * After the move the new academic year is set as current.
   */
  async executeTransition(
    institutionId: string,
    dto: {
      newYearName: string;
      newYearStartDate: string;
      newYearEndDate: string;
      classMap: Array<{ sourceUnitId: string; targetUnitId: string | null }>;
    },
  ) {
    if (!dto.classMap.length) {
      throw new BadRequestException('Class progression map cannot be empty');
    }

    // Guard: duplicate sourceUnitIds would double-process the same class
    const sourceIds = dto.classMap.map((m) => m.sourceUnitId);
    if (new Set(sourceIds).size !== sourceIds.length) {
      throw new BadRequestException('classMap contains duplicate source class IDs');
    }

    const startDate = parseDateOnly(dto.newYearStartDate);
    const endDate = parseDateOnly(dto.newYearEndDate);
    if (!startDate || !endDate) {
      throw new BadRequestException('Invalid year dates');
    }

    const name = dto.newYearName.trim();
    if (!/^\d{4}-\d{2}$/.test(name)) {
      throw new BadRequestException('Year name must be in format YYYY-YY (e.g. 2026-27)');
    }

    // Guard: if the target year already exists and is current, the transition was already run
    const existingYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, name },
    });
    if (existingYear?.isCurrent) {
      throw new BadRequestException(
        `Academic year "${name}" is already active. The transition has already been executed.`,
      );
    }

    // Validate all unit IDs belong to this institution
    const allUnitIds = [
      ...dto.classMap.map((m) => m.sourceUnitId),
      ...dto.classMap.filter((m) => m.targetUnitId).map((m) => m.targetUnitId!),
    ];
    const uniqueIds = [...new Set(allUnitIds)];
    const foundUnits = await this.prisma.academicUnit.findMany({
      where: { id: { in: uniqueIds }, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (foundUnits.length !== uniqueIds.length) {
      throw new BadRequestException('One or more class IDs not found in this institution');
    }

    // Create new year if it doesn't already exist (reuse the record found above)
    let newYear = existingYear;
    if (!newYear) {
      newYear = await this.prisma.academicYear.create({
        data: { institutionId, name, startDate, endDate, isCurrent: false },
      });
    }

    let studentsPromoted = 0;
    let studentsGraduated = 0;
    let studentsHeldBackReset = 0;

    await this.prisma.$transaction(async (tx) => {
      // Process in REVERSE order (Class12 → Class11 → … → Class1) so that
      // when we move Class N students into Class N+1, those students are never
      // counted as "existing" when we later compute roll numbers for Class N-1
      // students moving into Class N.
      for (const mapping of [...dto.classMap].reverse()) {
        const students = await tx.student.findMany({
          where: {
            institutionId,
            academicUnitId: mapping.sourceUnitId,
            deletedAt: null,
            status: { in: ['active', 'held_back'] },
          },
          select: { id: true, status: true },
          orderBy: { rollNo: 'asc' },
        });
        if (!students.length) continue;

        const active = students.filter((s) => s.status === 'active');
        const heldBack = students.filter((s) => s.status === 'held_back');

        if (active.length > 0) {
          if (!mapping.targetUnitId) {
            // Graduate: exit school
            await tx.student.updateMany({
              where: { id: { in: active.map((s) => s.id) }, institutionId },
              data: { status: 'graduated', academicUnitId: null },
            });
            studentsGraduated += active.length;
          } else {
            // Promote: assign to next class with sequential roll numbers
            const existingCount = await tx.student.count({
              where: { academicUnitId: mapping.targetUnitId, deletedAt: null },
            });
            await Promise.all(
              active.map((s, idx) =>
                tx.student.update({
                  where: { id: s.id },
                  data: {
                    academicUnitId: mapping.targetUnitId,
                    rollNo: String(existingCount + idx + 1).padStart(2, '0'),
                    status: 'active',
                  },
                }),
              ),
            );
            studentsPromoted += active.length;
          }
        }

        if (heldBack.length > 0) {
          // Reset held-back students for the new year — they repeat in the same class
          await tx.student.updateMany({
            where: { id: { in: heldBack.map((s) => s.id) }, institutionId },
            data: { status: 'active' },
          });
          studentsHeldBackReset += heldBack.length;
        }
      }

      // Activate the new year
      await tx.academicYear.updateMany({
        where: { institutionId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.academicYear.update({
        where: { id: newYear!.id },
        data: { isCurrent: true },
      });
    });

    return { studentsPromoted, studentsGraduated, studentsHeldBackReset, newYearId: newYear.id, newYearName: newYear.name };
  }
}
