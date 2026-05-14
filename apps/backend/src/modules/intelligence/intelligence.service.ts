import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Today's Attendance Progress ───────────────────────────────────────────
  // Returns how many classes have marked attendance today vs. total classes.

  async getTodayAttendanceProgress(institutionId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const leafUnits = await this.prisma.academicUnit.findMany({
      where: { institutionId, deletedAt: null, level: 1 },
      select: { id: true, name: true, displayName: true },
      orderBy: { name: 'asc' },
    });

    if (leafUnits.length === 0) {
      return { totalClasses: 0, markedCount: 0, unmarkedCount: 0, markedPercent: 0, markedClasses: [], unmarkedClasses: [] };
    }

    // Only count the daily (non-subject) session per class
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        institutionId,
        date: { gte: today, lt: tomorrow },
        academicUnitId: { in: leafUnits.map((u) => u.id) },
        subjectId: null,
      },
      select: { academicUnitId: true, takenByUserId: true },
    });

    const markedIds = new Set(sessions.map((s) => s.academicUnitId));
    const markedClasses = leafUnits.filter((u) => markedIds.has(u.id)).map((u) => ({ id: u.id, name: u.displayName || u.name }));
    const unmarkedClasses = leafUnits.filter((u) => !markedIds.has(u.id)).map((u) => ({ id: u.id, name: u.displayName || u.name }));

    return {
      totalClasses: leafUnits.length,
      markedCount: markedClasses.length,
      unmarkedCount: unmarkedClasses.length,
      markedPercent: Math.round((markedClasses.length / leafUnits.length) * 100),
      markedClasses,
      unmarkedClasses,
    };
  }

  // ── Teacher Efficiency ────────────────────────────────────────────────────
  // For each class with an assigned class teacher, returns:
  //   - days since they last marked attendance
  //   - how many sessions they've marked in the last 7 days
  //   - alert flag if they haven't marked in 2+ days

  async getTeacherEfficiency(institutionId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    // Classes that have a class teacher assigned
    const classesWithTeachers = await this.prisma.academicUnit.findMany({
      where: { institutionId, deletedAt: null, level: 1, classTeacherUserId: { not: null } },
      select: {
        id: true,
        name: true,
        displayName: true,
        classTeacherUserId: true,
        classTeacher: { select: { id: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (classesWithTeachers.length === 0) return [];

    const teacherIds = classesWithTeachers.map((c) => c.classTeacherUserId!);
    const unitIds = classesWithTeachers.map((c) => c.id);

    // All daily attendance sessions by these teachers for their classes in the last 7 days
    const recentSessions = await this.prisma.attendanceSession.findMany({
      where: {
        institutionId,
        academicUnitId: { in: unitIds },
        takenByUserId: { in: teacherIds },
        date: { gte: sevenDaysAgo, lte: today },
        subjectId: null,
      },
      select: { academicUnitId: true, takenByUserId: true, date: true },
      orderBy: { date: 'desc' },
    });

    // Earliest session ever per teacher+unit to detect teachers who've never marked
    const allTimeSessions = await this.prisma.attendanceSession.findMany({
      where: {
        institutionId,
        academicUnitId: { in: unitIds },
        takenByUserId: { in: teacherIds },
        subjectId: null,
      },
      select: { academicUnitId: true, takenByUserId: true, date: true },
      orderBy: { date: 'desc' },
      take: classesWithTeachers.length * 5, // enough to find the latest per class
    });

    return classesWithTeachers.map((unit) => {
      const teacherId = unit.classTeacherUserId!;

      // Sessions this teacher has marked for this class in last 7 days
      const thisWeekSessions = recentSessions.filter(
        (s) => s.takenByUserId === teacherId && s.academicUnitId === unit.id,
      );

      // Most recent session ever for this teacher+class
      const lastSession = allTimeSessions.find(
        (s) => s.takenByUserId === teacherId && s.academicUnitId === unit.id,
      );

      const lastMarkedDate = lastSession?.date ?? null;
      const daysSinceLastMark = lastMarkedDate
        ? Math.floor((today.getTime() - new Date(lastMarkedDate).setHours(0, 0, 0, 0)) / 86400000)
        : null;

      return {
        teacherId,
        teacherEmail: unit.classTeacher?.email ?? null,
        className: unit.displayName || unit.name,
        academicUnitId: unit.id,
        daysSinceLastMark,
        sessionsThisWeek: thisWeekSessions.length,
        lastMarkedDate,
        // Alert: never marked, or hasn't marked in 2+ working days
        alert: daysSinceLastMark === null || daysSinceLastMark >= 2,
      };
    }).sort((a, b) => (b.daysSinceLastMark ?? 9999) - (a.daysSinceLastMark ?? 9999));
  }

  // ── Pending Actions ───────────────────────────────────────────────────────
  // Counts and lists everything that needs the principal/director's attention:
  //   - pending TC requests
  //   - pending staff leave requests
  //   - staff on approved leave today
  //   - active exams with incomplete mark entry
  //   - staff who came in late this week

  async getPendingActions(institutionId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Monday of the current week (ISO week: Mon = 1)
    const dow = today.getDay(); // 0 = Sun
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);

    const [pendingTCCount, pendingLeaveCount, staffOnLeaveToday, activeExams, lateStaffThisWeek] =
      await Promise.all([
        this.prisma.transferCertificate.count({ where: { institutionId, status: 'pending' } }),
        this.prisma.staffLeaveRequest.count({ where: { institutionId, status: 'pending' } }),

        // Approved leave overlapping today
        this.prisma.staffLeaveRequest.findMany({
          where: {
            institutionId,
            status: 'approved',
            startDate: { lte: today },
            endDate: { gte: today },
          },
          select: {
            userId: true,
            startDate: true,
            endDate: true,
            reason: true,
            user: { select: { id: true, email: true } },
          },
        }),

        this.prisma.exam.findMany({
          where: { institutionId, status: 'active', deletedAt: null },
          select: { id: true, name: true },
        }),

        this.prisma.staffAttendance.findMany({
          where: { institutionId, status: 'late', date: { gte: monday, lte: today } },
          select: {
            userId: true,
            date: true,
            user: { select: { id: true, email: true } },
          },
          orderBy: { date: 'desc' },
        }),
      ]);

    // For each active exam, compute mark completeness without N+1 queries
    const examAlerts: {
      examId: string;
      examName: string;
      completionPercent: number;
      pendingSlots: number;
      totalSlots: number;
    }[] = [];

    if (activeExams.length > 0 && activeExams.length <= 10) {
      const examIds = activeExams.map((e) => e.id);

      const [allExamSubjects, studentCounts, resultCounts] = await Promise.all([
        this.prisma.examSubject.findMany({
          where: { examId: { in: examIds } },
          select: { examId: true, academicUnitId: true, subjectId: true },
        }),
        this.prisma.student.groupBy({
          by: ['academicUnitId'],
          where: {
            institutionId,
            academicUnitId: { in: [] }, // filled below after we know unitIds
            deletedAt: null,
            status: 'active',
          },
          _count: { id: true },
        }),
        this.prisma.examResult.groupBy({
          by: ['examId', 'academicUnitId', 'subjectId'],
          where: { institutionId, examId: { in: examIds } },
          _count: { id: true },
        }),
      ]);

      const unitIds = [...new Set(allExamSubjects.map((es) => es.academicUnitId))];

      // Re-fetch student counts with correct unit filter
      const studentCountsFiltered = await this.prisma.student.groupBy({
        by: ['academicUnitId'],
        where: { institutionId, academicUnitId: { in: unitIds }, deletedAt: null, status: 'active' },
        _count: { id: true },
      });

      const studentCountMap = new Map(studentCountsFiltered.map((g) => [g.academicUnitId, g._count.id]));
      const resultCountMap = new Map(
        resultCounts.map((g) => [`${g.examId}|${g.academicUnitId}|${g.subjectId}`, g._count.id]),
      );

      for (const exam of activeExams) {
        const subjects = allExamSubjects.filter((es) => es.examId === exam.id);
        if (subjects.length === 0) continue;

        const pendingSlots = subjects.filter((es) => {
          const total = studentCountMap.get(es.academicUnitId) ?? 0;
          const entered = resultCountMap.get(`${es.examId}|${es.academicUnitId}|${es.subjectId}`) ?? 0;
          return total > 0 && entered < total;
        }).length;

        const totalSlots = subjects.length;
        if (pendingSlots > 0) {
          examAlerts.push({
            examId: exam.id,
            examName: exam.name,
            totalSlots,
            pendingSlots,
            completionPercent: Math.round(((totalSlots - pendingSlots) / totalSlots) * 100),
          });
        }
      }
    }

    return {
      pendingTCCount,
      pendingLeaveCount,
      staffOnLeaveToday: staffOnLeaveToday.map((l) => ({
        userId: l.userId,
        email: l.user.email,
        startDate: l.startDate,
        endDate: l.endDate,
        reason: l.reason,
      })),
      examAlerts,
      lateStaffThisWeek: lateStaffThisWeek.map((a) => ({
        userId: a.userId,
        email: a.user.email,
        date: a.date,
      })),
    };
  }

  // ── Academic Overview ─────────────────────────────────────────────────────
  // Class-wise average performance across all completed exams in a year.
  // Used to spot which class is underperforming without opening each exam.

  async getAcademicOverview(institutionId: string, academicYearId: string) {
    const completedExams = await this.prisma.exam.findMany({
      where: { institutionId, academicYearId, status: 'completed', deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    if (completedExams.length === 0) return { exams: [], classAverages: [] };

    const examIds = completedExams.map((e) => e.id);

    const [leafUnits, allExamSubjects, allResults] = await Promise.all([
      this.prisma.academicUnit.findMany({
        where: { institutionId, deletedAt: null, level: 1 },
        select: { id: true, name: true, displayName: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.examSubject.findMany({
        where: { examId: { in: examIds } },
        select: { examId: true, academicUnitId: true, subjectId: true, maxMarks: true },
      }),
      this.prisma.examResult.findMany({
        where: { institutionId, examId: { in: examIds }, isAbsent: false, marksObtained: { not: null } },
        select: { examId: true, academicUnitId: true, studentId: true, marksObtained: true },
      }),
    ]);

    const classAverages = leafUnits.map((unit) => {
      const exams = completedExams.map((exam) => {
        const subjects = allExamSubjects.filter(
          (es) => es.examId === exam.id && es.academicUnitId === unit.id,
        );
        const totalMax = subjects.reduce((s, es) => s + es.maxMarks, 0);
        if (totalMax === 0) return { examId: exam.id, examName: exam.name, avgPercent: null as number | null };

        const unitResults = allResults.filter(
          (r) => r.examId === exam.id && r.academicUnitId === unit.id,
        );

        // Sum marks per student
        const byStudent = new Map<string, number>();
        for (const r of unitResults) {
          byStudent.set(r.studentId, (byStudent.get(r.studentId) ?? 0) + (r.marksObtained ?? 0));
        }
        if (byStudent.size === 0) return { examId: exam.id, examName: exam.name, avgPercent: null as number | null };

        const avgTotal = Array.from(byStudent.values()).reduce((s, v) => s + v, 0) / byStudent.size;
        return { examId: exam.id, examName: exam.name, avgPercent: Math.round((avgTotal / totalMax) * 100) };
      });

      const validExams = exams.filter((e) => e.avgPercent !== null);
      const overallAvg =
        validExams.length > 0
          ? Math.round(validExams.reduce((s, e) => s + (e.avgPercent ?? 0), 0) / validExams.length)
          : null;

      return {
        unitId: unit.id,
        className: unit.displayName || unit.name,
        exams,
        overallAvg,
      };
    }).filter((u) => u.exams.some((e) => e.avgPercent !== null));

    return {
      exams: completedExams,
      classAverages: classAverages.sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1)),
    };
  }
}
