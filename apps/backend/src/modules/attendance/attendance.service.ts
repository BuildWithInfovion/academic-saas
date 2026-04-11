import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async save(institutionId: string, takenByUserId: string, dto: SaveAttendanceDto) {
    const date = new Date(dto.date);
    const subjectId = dto.subjectId ?? null;

    // Verify all student IDs belong to this institution — prevents cross-tenant injection
    if (dto.records.length > 0) {
      const studentIds = dto.records.map((r) => r.studentId);
      const validStudents = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, institutionId, deletedAt: null },
        select: { id: true },
      });
      if (validStudents.length !== studentIds.length) {
        throw new ForbiddenException('One or more student IDs do not belong to your institution');
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

  // Defaulter list: students below threshold % in a unit for a month
  async getDefaulters(institutionId: string, academicUnitId: string, year: number, month: number, threshold = 75) {
    const students = await this.getStudentsForUnit(institutionId, academicUnitId);
    const results = await Promise.all(
      students.map(async (s) => {
        const summary = await this.getStudentMonthly(institutionId, s.id, year, month);
        return { ...s, ...summary };
      }),
    );
    return results.filter((r) => r.total > 0 && r.percentage < threshold);
  }
}
