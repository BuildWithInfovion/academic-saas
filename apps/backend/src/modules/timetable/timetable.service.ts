import { Injectable, ForbiddenException } from '@nestjs/common';
import { IsInt, IsString, IsOptional, Min, Max, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';

export class PeriodConfigEntryDto {
  @IsInt() @Min(1) @Type(() => Number)
  sortOrder: number;

  @IsString()
  label: string;

  @IsBoolean()
  isBreak: boolean;

  @IsString()
  startTime: string; // "HH:MM"

  @IsString()
  endTime: string;   // "HH:MM"
}

export class SavePeriodConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeriodConfigEntryDto)
  entries: PeriodConfigEntryDto[];
}

export class SaveSlotDto {
  @IsInt() @Min(1) @Max(6) @Type(() => Number)
  dayOfWeek: number;

  @IsInt() @Min(1) @Type(() => Number)
  periodNo: number;

  @IsString() @IsOptional()
  subjectId: string | null;

  @IsString() @IsOptional()
  teacherUserId: string | null;
}

export class GenerateTimetableDto {
  @IsInt() @Min(1) @Max(15) @IsOptional() @Type(() => Number)
  periodsPerDay?: number;

  @IsArray() @IsInt({ each: true }) @IsOptional()
  workingDays?: number[];
}

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  async getForUnit(institutionId: string, academicUnitId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: { institutionId, academicUnitId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
    });

    // Fetch teacher labels separately (no relation on timetable_slots).
    // institutionId MUST be included so a slot that somehow references a teacher
    // from another tenant (e.g. via a previously stored bad value) never leaks
    // cross-tenant user data.
    const teacherIds = [...new Set(slots.map((s) => s.teacherUserId).filter(Boolean))] as string[];
    const teachers =
      teacherIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: teacherIds }, institutionId },
            select: { id: true, name: true, email: true, phone: true },
          })
        : [];
    const teacherMap = new Map(teachers.map((t) => [t.id, t]));

    return slots.map((s) => ({
      ...s,
      teacher: s.teacherUserId ? (teacherMap.get(s.teacherUserId) ?? null) : null,
    }));
  }

  async saveSlot(institutionId: string, academicUnitId: string, dto: SaveSlotDto) {
    // Verify the academic unit belongs to the caller's institution before writing
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: academicUnitId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new ForbiddenException('Academic unit not found in your institution');

    // Verify the teacher (if provided) belongs to the same institution.
    // Without this check an attacker could assign a user ID from another tenant,
    // then read that user's email/phone back via getForUnit().
    if (dto.teacherUserId) {
      const teacher = await this.prisma.user.findFirst({
        where: { id: dto.teacherUserId, institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!teacher) throw new ForbiddenException('Teacher not found in your institution');
    }

    return this.prisma.timetableSlot.upsert({
      where: {
        academicUnitId_dayOfWeek_periodNo: {
          academicUnitId,
          dayOfWeek: dto.dayOfWeek,
          periodNo: dto.periodNo,
        },
      },
      create: {
        institutionId,
        academicUnitId,
        dayOfWeek: dto.dayOfWeek,
        periodNo: dto.periodNo,
        subjectId: dto.subjectId,
        teacherUserId: dto.teacherUserId,
      },
      update: {
        subjectId: dto.subjectId,
        teacherUserId: dto.teacherUserId,
      },
    });
  }

  // Auto-generate: distribute assigned subjects evenly across the week
  async generate(
    institutionId: string,
    academicUnitId: string,
    periodsPerDay: number,
    workingDays: number[],   // e.g. [1,2,3,4,5]
  ) {
    const unitSubjects = await this.prisma.academicUnitSubject.findMany({
      where: { institutionId, academicUnitId },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { subject: { name: 'asc' } },
    });

    if (unitSubjects.length === 0) return { generated: 0 };

    const totalSlots = workingDays.length * periodsPerDay;
    const slots: { dayOfWeek: number; periodNo: number; subjectId: string; teacherUserId: string | null }[] = [];

    let subjectIdx = 0;
    for (const day of workingDays) {
      for (let p = 1; p <= periodsPerDay; p++) {
        const us = unitSubjects[subjectIdx % unitSubjects.length];
        slots.push({
          dayOfWeek: day,
          periodNo: p,
          subjectId: us.subjectId,
          teacherUserId: us.teacherUserId ?? null,
        });
        subjectIdx++;
      }
    }

    // Delete existing and re-create atomically — if createMany fails the old
    // timetable is preserved rather than leaving the class with no schedule.
    await this.prisma.$transaction([
      this.prisma.timetableSlot.deleteMany({ where: { institutionId, academicUnitId } }),
      this.prisma.timetableSlot.createMany({
        data: slots.map((s) => ({
          institutionId,
          academicUnitId,
          dayOfWeek: s.dayOfWeek,
          periodNo: s.periodNo,
          subjectId: s.subjectId,
          teacherUserId: s.teacherUserId,
          updatedAt: new Date(),
        })),
      }),
    ]);

    return { generated: totalSlots, slots };
  }

  // Period config: institution-wide day schedule
  async getPeriodConfig(institutionId: string) {
    return this.prisma.periodConfig.findMany({
      where: { institutionId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async savePeriodConfig(institutionId: string, dto: SavePeriodConfigDto) {
    const entries = dto.entries;
    await this.prisma.$transaction([
      this.prisma.periodConfig.deleteMany({ where: { institutionId } }),
      this.prisma.periodConfig.createMany({
        data: entries.map((e) => ({
          institutionId,
          sortOrder: e.sortOrder,
          label: e.label,
          isBreak: e.isBreak,
          startTime: e.startTime,
          endTime: e.endTime,
          updatedAt: new Date(),
        })),
      }),
    ]);
    return this.prisma.periodConfig.findMany({
      where: { institutionId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // What a teacher teaches across all classes (for teacher portal)
  async getMySubjectSchedule(institutionId: string, teacherUserId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: { institutionId, teacherUserId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        academicUnit: {
          select: {
            id: true, name: true, displayName: true,
            parent: { select: { name: true, displayName: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
    });
    return slots;
  }
}
