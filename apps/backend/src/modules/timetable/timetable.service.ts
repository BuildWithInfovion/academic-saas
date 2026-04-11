import { Injectable, ForbiddenException } from '@nestjs/common';
import { IsInt, IsString, IsOptional, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';

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

    // Fetch teacher labels separately (no relation on timetable_slots)
    const teacherIds = [...new Set(slots.map((s) => s.teacherUserId).filter(Boolean))] as string[];
    const teachers =
      teacherIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: teacherIds } },
            select: { id: true, email: true, phone: true },
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

    // Delete existing and re-create
    await this.prisma.timetableSlot.deleteMany({ where: { institutionId, academicUnitId } });
    await this.prisma.timetableSlot.createMany({
      data: slots.map((s) => ({
        institutionId,
        academicUnitId,
        dayOfWeek: s.dayOfWeek,
        periodNo: s.periodNo,
        subjectId: s.subjectId,
        teacherUserId: s.teacherUserId,
        updatedAt: new Date(),
      })),
    });

    return { generated: totalSlots, slots };
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
