import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async save(
    institutionId: string,
    takenByUserId: string,
    dto: SaveAttendanceDto,
    callerRoles: string[] = [],
  ) {
    const date = new Date(dto.date);
    const subjectId = dto.subjectId ?? null;

    // Reject future dates — attendance cannot be pre-marked
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      throw new BadRequestException('Cannot mark attendance for a future date');
    }

    // C-06: Verify the academicUnitId belongs to this institution
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: dto.academicUnitId, institutionId, deletedAt: null },
      select: { id: true, classTeacherUserId: true },
    });
    if (!unit) {
      throw new ForbiddenException('Academic unit not found or does not belong to your institution');
    }

    // C-06: Operators, admins, principals, and receptionists may mark for any class.
    // Teachers may only mark for classes they are assigned to.
    const privilegedRoles = ['admin', 'principal', 'super_admin', 'receptionist'];
    const isPrivileged = callerRoles.some((r) => privilegedRoles.includes(r));

    if (!isPrivileged) {
      const isClassTeacher = unit.classTeacherUserId === takenByUserId;
      let isSubjectTeacher = false;
      if (!isClassTeacher) {
        const assignment = await this.prisma.academicUnitSubject.findFirst({
          where: { academicUnitId: dto.academicUnitId, teacherUserId: takenByUserId },
          select: { id: true },
        });
        isSubjectTeacher = !!assignment;
      }
      if (!isClassTeacher && !isSubjectTeacher) {
        throw new ForbiddenException('You are not assigned to this class and cannot mark attendance for it');
      }
    }

    // Verify all student IDs belong to THIS institution AND this specific academic unit.
    // Checking only institutionId would allow a teacher assigned to Class 1A to inject
    // attendance records for students in Class 10B by supplying their IDs.
    if (dto.records.length > 0) {
      const studentIds = dto.records.map((r) => r.studentId);
      const validStudents = await this.prisma.student.findMany({
        where: {
          id: { in: studentIds },
          institutionId,
          academicUnitId: dto.academicUnitId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (validStudents.length !== studentIds.length) {
        throw new ForbiddenException(
          'One or more student IDs do not belong to this class or institution',
        );
      }
    }

    // Find or create the session (upsert can't match null in compound unique)
    let session = await this.prisma.attendanceSession.findFirst({
      where: { institutionId, academicUnitId: dto.academicUnitId, date, subjectId },
    });
    if (session) {
      session = await this.prisma.attendanceSession.update({
        where: { id: session.id },
        data: { takenByUserId },
      });
    } else {
      session = await this.prisma.attendanceSession.create({
        data: { institutionId, academicUnitId: dto.academicUnitId, subjectId, date, takenByUserId },
      });
    }

    // Upsert each record
    await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } },
          create: {
            institutionId,
            sessionId: session.id,
            studentId: r.studentId,
            status: r.status,
            remarks: r.remarks,
          },
          update: { status: r.status, remarks: r.remarks },
        }),
      ),
    );

    return this.getSession(session.id);
  }

  async getSession(sessionId: string) {
    return this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        records: {
          include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true } } },
          orderBy: { student: { firstName: 'asc' } },
        },
      },
    });
  }

  async getByUnitAndDate(institutionId: string, academicUnitId: string, date: string, subjectId?: string) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        institutionId,
        academicUnitId,
        date: new Date(date),
        subjectId: subjectId ?? null,
      },
      include: {
        records: {
          include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true } } },
          orderBy: { student: { firstName: 'asc' } },
        },
      },
    });
    return session;
  }

  // Get all students for a unit so operator can mark (even if no session yet)
  async getStudentsForUnit(institutionId: string, academicUnitId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, academicUnitId, deletedAt: null, status: 'active' },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true },
    });
  }

  // Monthly summary for a student
  async getStudentMonthly(institutionId: string, studentId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentId,
        session: { date: { gte: start, lt: end } },
      },
      include: { session: { select: { date: true, subjectId: true } } },
      orderBy: { session: { date: 'asc' } },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const leave = records.filter((r) => r.status === 'leave').length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, leave, percentage, records };
  }

  // Class-wise attendance for a date
  async getClassDailySummary(institutionId: string, academicUnitId: string, date: string) {
    const session = await this.getByUnitAndDate(institutionId, academicUnitId, date);
    const allStudents = await this.getStudentsForUnit(institutionId, academicUnitId);

    if (!session) {
      return { date, academicUnitId, taken: false, students: allStudents, records: [] };
    }

    return {
      date,
      academicUnitId,
      sessionId: session.id,
      taken: true,
      students: allStudents,
      records: session.records,
    };
  }

  // Today's attendance status for children linked to a parent user
  async getParentAbsentNotifications(institutionId: string, parentUserId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const students = await this.prisma.student.findMany({
      where: { institutionId, parentUserId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        academicUnitId: true,
        academicUnit: {
          select: {
            id: true, name: true, displayName: true,
            parent: { select: { name: true, displayName: true } },
          },
        },
      },
    });

    if (students.length === 0) {
      return {
        linked: false,
        students: [],
        absentToday: [],
        attendanceTakenToday: false,
        date: today.toISOString().split('T')[0],
      };
    }

    const studentIds = students.map((s) => s.id);
    const unitIds = [...new Set(students.map((s) => s.academicUnitId).filter(Boolean))] as string[];

    // Check if any attendance session was taken today for these classes
    const sessionsToday = unitIds.length > 0
      ? await this.prisma.attendanceSession.findMany({
          where: {
            institutionId,
            academicUnitId: { in: unitIds },
            date: { gte: today, lt: tomorrow },
          },
          select: { id: true, academicUnitId: true },
        })
      : [];

    const attendanceTakenToday = sessionsToday.length > 0;

    const absentRecords = attendanceTakenToday
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            institutionId,
            studentId: { in: studentIds },
            status: 'absent',
            session: { date: { gte: today, lt: tomorrow } },
          },
          include: {
            session: { select: { date: true, subject: { select: { id: true, name: true } } } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      : [];

    return {
      linked: true,
      students,
      absentToday: absentRecords,
      attendanceTakenToday,
      date: today.toISOString().split('T')[0],
    };
  }

  // Class-wise monthly attendance report — all students × all dates in the month
  async getClassMonthlyReport(institutionId: string, academicUnitId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);

    const [students, sessions] = await Promise.all([
      this.prisma.student.findMany({
        where: { institutionId, academicUnitId, deletedAt: null, status: 'active' },
        orderBy: [{ rollNo: 'asc' }, { firstName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true },
      }),
      this.prisma.attendanceSession.findMany({
        where: { institutionId, academicUnitId, date: { gte: start, lt: end }, subjectId: null },
        include: {
          records: { select: { studentId: true, status: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const dates = sessions.map((s) => s.date.toISOString().slice(0, 10));

    // Build lookup: sessionId → Map<studentId, status>
    const sessionMaps = sessions.map((s) => {
      const m = new Map<string, string>();
      for (const r of s.records) m.set(r.studentId, r.status);
      return m;
    });

    const rows = students.map((stu) => {
      const daily: (string | null)[] = sessionMaps.map((m) => m.get(stu.id) ?? null);
      const present = daily.filter((d) => d === 'present' || d === 'late').length;
      const absent  = daily.filter((d) => d === 'absent').length;
      const leave   = daily.filter((d) => d === 'leave').length;
      const total   = sessions.length;
      const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
      return { ...stu, daily, present, absent, leave, total, percentage: pct };
    });

    return { year, month, academicUnitId, dates, rows };
  }

  // Class-level attendance summary for dashboard chart
  async getClassSummary(institutionId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);
    const units = await this.prisma.academicUnit.findMany({
      where: { institutionId, deletedAt: null, level: 1 },
      select: { id: true, name: true, displayName: true },
      orderBy: { name: 'asc' },
    });
    if (units.length === 0) return [];
    const sessions = await this.prisma.attendanceSession.findMany({
      where: { institutionId, date: { gte: start, lt: end }, academicUnitId: { in: units.map((u) => u.id) } },
      select: { id: true, academicUnitId: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const records = sessionIds.length === 0 ? [] : await this.prisma.attendanceRecord.findMany({
      where: { institutionId, sessionId: { in: sessionIds } },
      select: { sessionId: true, status: true },
    });
    const sessionToUnit = new Map(sessions.map((s) => [s.id, s.academicUnitId]));
    const unitStats = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const uid = sessionToUnit.get(r.sessionId) ?? '';
      if (!unitStats.has(uid)) unitStats.set(uid, { present: 0, total: 0 });
      const s = unitStats.get(uid)!;
      s.total++;
      if (r.status === 'present' || r.status === 'late') s.present++;
    }
    return units.map((u) => {
      const s = unitStats.get(u.id) ?? { present: 0, total: 0 };
      return {
        unitId: u.id,
        name: u.displayName || u.name,
        percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
        totalRecords: s.total,
      };
    }).filter((u) => u.totalRecords > 0);
  }

  // Defaulter list: students below threshold % in a unit for a month
  // Optimised: 2 queries total instead of 1+N (one per student)
  async getDefaulters(institutionId: string, academicUnitId: string, year: number, month: number, threshold = 75) {
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);

    // Query 1: students in this class
    const students = await this.getStudentsForUnit(institutionId, academicUnitId);
    if (students.length === 0) return [];

    // Query 2: all attendance records for these students in the given month (flat, no N+1)
    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        institutionId,
        studentId: { in: students.map((s) => s.id) },
        session: { date: { gte: start, lt: end } },
      },
      select: { studentId: true, status: true },
    });

    // Aggregate per-student in memory — O(records) not O(students × records)
    type StatusCounts = { present: number; absent: number; late: number; leave: number; total: number };
    const counts = new Map<string, StatusCounts>();
    for (const rec of allRecords) {
      if (!counts.has(rec.studentId)) {
        counts.set(rec.studentId, { present: 0, absent: 0, late: 0, leave: 0, total: 0 });
      }
      const c = counts.get(rec.studentId)!;
      const key = rec.status as keyof Omit<StatusCounts, 'total'>;
      if (key in c) c[key]++;
      c.total++;
    }

    return students
      .map((s) => {
        const c = counts.get(s.id) ?? { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
        const percentage = c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 0;
        return { ...s, ...c, percentage };
      })
      .filter((r) => r.total > 0 && r.percentage < threshold);
  }
}
