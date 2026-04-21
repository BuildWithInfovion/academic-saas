import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IsString, IsDateString, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class MarkAbsentDto {
  @IsString()
  teacherId: string;

  @IsDateString()
  date: string; // ISO date string, e.g. "2025-04-22"
}

export class AssignSubstituteDto {
  @IsString()
  substituteId: string;
}

const TEACHER_SELECT = { id: true, name: true, email: true, phone: true } as const;

@Injectable()
export class CoverService {
  constructor(private prisma: PrismaService) {}

  // Mark a teacher absent for a date — creates TimetableCover records for each of their periods
  async markTeacherAbsent(institutionId: string, dto: MarkAbsentDto) {
    const date = new Date(dto.date);
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // JS: 0=Sun, we use 1=Mon–6=Sat

    // Verify teacher belongs to institution
    const teacher = await this.prisma.user.findFirst({
      where: { id: dto.teacherId, institutionId, deletedAt: null },
      select: TEACHER_SELECT,
    });
    if (!teacher) throw new ForbiddenException('Teacher not found in your institution');

    // Find all timetable slots for this teacher on that day of week
    const slots = await this.prisma.timetableSlot.findMany({
      where: { institutionId, teacherUserId: dto.teacherId, dayOfWeek },
      include: {
        academicUnit: { select: { id: true, name: true, displayName: true, parent: { select: { name: true, displayName: true } } } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    if (slots.length === 0) {
      return { message: 'No timetable periods found for this teacher on this day', covers: [] };
    }

    // Upsert cover records (skip if already marked absent for some periods)
    const covers = await Promise.all(
      slots.map((slot) =>
        this.prisma.timetableCover.upsert({
          where: {
            institutionId_date_academicUnitId_periodNo: {
              institutionId,
              date,
              academicUnitId: slot.academicUnitId,
              periodNo: slot.periodNo,
            },
          },
          create: {
            institutionId,
            date,
            dayOfWeek,
            periodNo: slot.periodNo,
            academicUnitId: slot.academicUnitId,
            subjectId: slot.subjectId,
            absentTeacherId: dto.teacherId,
            status: 'uncovered',
          },
          update: {}, // don't overwrite if already exists (may already have substitute)
        }),
      ),
    );

    return { teacher, covers, message: `${covers.length} period(s) marked as needing cover` };
  }

  // Get all covers for a specific date, enriched with teacher + class + subject info
  async getCoversForDate(institutionId: string, dateStr: string) {
    const date = new Date(dateStr);

    const covers = await this.prisma.timetableCover.findMany({
      where: { institutionId, date },
      include: {
        academicUnit: {
          select: {
            id: true, name: true, displayName: true,
            parent: { select: { name: true, displayName: true } },
          },
        },
      },
      orderBy: [{ absentTeacherId: 'asc' }, { periodNo: 'asc' }],
    });

    if (covers.length === 0) return [];

    // Gather all user IDs (absent teachers + substitutes)
    const allUserIds = [
      ...new Set([
        ...covers.map((c) => c.absentTeacherId),
        ...covers.map((c) => c.substituteId).filter(Boolean) as string[],
      ]),
    ];

    const [users, subjects] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: allUserIds }, institutionId },
        select: TEACHER_SELECT,
      }),
      this.prisma.subject.findMany({
        where: { id: { in: covers.map((c) => c.subjectId).filter(Boolean) as string[] }, institutionId },
        select: { id: true, name: true, code: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    return covers.map((c) => ({
      ...c,
      absentTeacher: userMap.get(c.absentTeacherId) ?? null,
      substitute: c.substituteId ? (userMap.get(c.substituteId) ?? null) : null,
      subject: c.subjectId ? (subjectMap.get(c.subjectId) ?? null) : null,
    }));
  }

  // Get teachers who are free during a specific period on a given date
  async getAvailableTeachers(institutionId: string, dateStr: string, dayOfWeek: number, periodNo: number) {
    const date = new Date(dateStr);

    // All teachers in institution
    const allTeachers = await this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
        roles: { some: { role: { institutionId, code: 'teacher' } } },
      },
      select: TEACHER_SELECT,
    });

    // Teachers already busy this period via master timetable
    const busyInTimetable = await this.prisma.timetableSlot.findMany({
      where: { institutionId, dayOfWeek, periodNo, teacherUserId: { not: null } },
      select: { teacherUserId: true },
    });

    // Teachers already assigned as substitute this period+date
    const busyAsSubstitute = await this.prisma.timetableCover.findMany({
      where: {
        institutionId, date, periodNo,
        substituteId: { not: null },
        status: { not: 'cancelled' },
      },
      select: { substituteId: true },
    });

    const busyIds = new Set([
      ...busyInTimetable.map((s) => s.teacherUserId as string),
      ...busyAsSubstitute.map((c) => c.substituteId as string),
    ]);

    return allTeachers.filter((t) => !busyIds.has(t.id));
  }

  // Assign a substitute to a cover record
  async assignSubstitute(institutionId: string, coverId: string, dto: AssignSubstituteDto) {
    const cover = await this.prisma.timetableCover.findFirst({
      where: { id: coverId, institutionId },
    });
    if (!cover) throw new NotFoundException('Cover record not found');

    // Verify substitute belongs to institution
    const substitute = await this.prisma.user.findFirst({
      where: { id: dto.substituteId, institutionId, deletedAt: null },
      select: TEACHER_SELECT,
    });
    if (!substitute) throw new ForbiddenException('Substitute teacher not found in your institution');

    // Check substitute isn't already busy that period (master timetable)
    const conflict = await this.prisma.timetableSlot.findFirst({
      where: { institutionId, dayOfWeek: cover.dayOfWeek, periodNo: cover.periodNo, teacherUserId: dto.substituteId },
    });
    if (conflict) throw new BadRequestException('This teacher already has a class during this period');

    // Check not already assigned as substitute elsewhere for this period+date
    const subConflict = await this.prisma.timetableCover.findFirst({
      where: {
        institutionId, date: cover.date, periodNo: cover.periodNo,
        substituteId: dto.substituteId, status: { not: 'cancelled' },
        NOT: { id: coverId },
      },
    });
    if (subConflict) throw new BadRequestException('This teacher is already covering another class during this period');

    return this.prisma.timetableCover.update({
      where: { id: coverId },
      data: { substituteId: dto.substituteId, status: 'covered' },
    });
  }

  // Remove substitute assignment from a cover
  async unassignSubstitute(institutionId: string, coverId: string) {
    const cover = await this.prisma.timetableCover.findFirst({
      where: { id: coverId, institutionId },
    });
    if (!cover) throw new NotFoundException('Cover record not found');

    return this.prisma.timetableCover.update({
      where: { id: coverId },
      data: { substituteId: null, status: 'uncovered' },
    });
  }

  // Cancel a cover record (teacher arrived after all, or marking was wrong)
  async cancelCover(institutionId: string, coverId: string) {
    const cover = await this.prisma.timetableCover.findFirst({
      where: { id: coverId, institutionId },
    });
    if (!cover) throw new NotFoundException('Cover record not found');

    return this.prisma.timetableCover.delete({ where: { id: coverId } });
  }

  // Teacher sees their own substitute duties for a date
  async getMyCoverDuties(institutionId: string, substituteId: string, dateStr: string) {
    const date = new Date(dateStr);

    const covers = await this.prisma.timetableCover.findMany({
      where: { institutionId, substituteId, date, status: 'covered' },
      include: {
        academicUnit: {
          select: {
            id: true, name: true, displayName: true,
            parent: { select: { name: true, displayName: true } },
          },
        },
      },
      orderBy: { periodNo: 'asc' },
    });

    if (covers.length === 0) return [];

    const subjectIds = covers.map((c) => c.subjectId).filter(Boolean) as string[];
    const absentIds = [...new Set(covers.map((c) => c.absentTeacherId))];

    const subjects = subjectIds.length > 0
      ? await this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, code: true } })
      : [];
    const absentTeachers = await this.prisma.user.findMany({
      where: { id: { in: absentIds }, institutionId },
      select: TEACHER_SELECT,
    });

    const subjectMap = new Map(subjects.map((s): [string, typeof s] => [s.id, s]));
    const absentMap = new Map(absentTeachers.map((t): [string, typeof t] => [t.id, t]));

    return covers.map((c) => ({
      ...c,
      subject: c.subjectId ? (subjectMap.get(c.subjectId) ?? null) : null,
      absentTeacher: absentMap.get(c.absentTeacherId) ?? null,
    }));
  }
}
