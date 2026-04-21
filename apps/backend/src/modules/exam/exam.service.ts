import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateExamDto,
  AddExamSubjectDto,
  BulkAddSubjectsDto,
  CloneSubjectsDto,
  SaveResultsDto,
} from './dto/exam.dto';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  // ── Exams CRUD ────────────────────────────────────────────────────────────

  async findAll(institutionId: string, academicYearId?: string) {
    return this.prisma.exam.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        academicYear: { select: { name: true } },
        _count: { select: { subjects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(institutionId: string, createdByUserId: string, dto: CreateExamDto) {
    const exam = await this.prisma.exam.create({
      data: {
        institutionId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        examCenter: dto.examCenter ?? null,
        reportingTime: dto.reportingTime ?? null,
        status: 'draft',
      },
    });

    // Auto-create a calendar event so exam dates appear on the school calendar
    if (dto.startDate && createdByUserId) {
      const start = new Date(dto.startDate);
      const end   = dto.endDate ? new Date(dto.endDate) : start;
      await this.prisma.calendarEvent.create({
        data: {
          institutionId,
          createdByUserId,
          title:     `Exam: ${dto.name}`,
          eventType: 'exam',
          startDate: start,
          endDate:   end,
          isAllDay:  true,
        },
      });
    }

    return exam;
  }

  async updateStatus(institutionId: string, examId: string, status: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Guard: cannot release results until every teacher has entered all marks
    if (status === 'completed') {
      const completeness = await this.getExamCompleteness(institutionId, examId);
      if (completeness.totalSlots === 0) {
        throw new BadRequestException(
          'No exam subjects configured. Add subjects before marking the exam as completed.',
        );
      }
      if (!completeness.allComplete) {
        const pending = completeness.entries
          .filter((e) => !e.complete)
          .map((e) => `${e.academicUnit.displayName ?? e.academicUnit.name} — ${e.subject.name} (${e.enteredCount}/${e.totalStudents} entered)`)
          .join('; ');
        throw new BadRequestException(
          `Cannot release results — marks not fully entered. Pending: ${pending}`,
        );
      }
    }

    // Guard: cannot revert a completed exam back to active/draft
    if (exam.status === 'completed' && status !== 'completed') {
      throw new BadRequestException(
        'A completed exam cannot be reverted. Results are already visible to parents.',
      );
    }

    return this.prisma.exam.update({ where: { id: examId }, data: { status } });
  }

  async delete(institutionId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Guard: refuse to delete an exam that already has student results to prevent data loss
    const resultCount = await this.prisma.examResult.count({ where: { examId } });
    if (resultCount > 0) {
      throw new BadRequestException(
        `Cannot delete this exam — it has ${resultCount} student result(s) recorded. Archive or keep it instead.`,
      );
    }

    // Soft-delete: mark as deleted rather than physically removing the row
    return this.prisma.exam.update({
      where: { id: examId },
      data: { deletedAt: new Date() },
    });
  }

  // ── Exam Subjects ─────────────────────────────────────────────────────────

  async getExamSubjects(institutionId: string, examId: string) {
    // Verify exam belongs to caller's institution before returning subjects
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.examSubject.findMany({
      where: { examId },
      include: {
        subject: true,
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
      orderBy: [
        { academicUnit: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  async addExamSubject(
    institutionId: string,
    examId: string,
    dto: AddExamSubjectDto,
  ) {
    // Verify exam belongs to caller's institution before modifying
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Validate that academicUnitId and subjectId both belong to this institution.
    // Without this, a caller could cross-link units or subjects from a different tenant.
    const [unit, subject] = await Promise.all([
      this.prisma.academicUnit.findFirst({
        where: { id: dto.academicUnitId, institutionId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.subject.findFirst({
        where: { id: dto.subjectId, institutionId },
        select: { id: true },
      }),
    ]);
    if (!unit) throw new NotFoundException('Academic unit not found in this institution');
    if (!subject) throw new NotFoundException('Subject not found in this institution');

    return this.prisma.examSubject.upsert({
      where: {
        examId_academicUnitId_subjectId: {
          examId,
          academicUnitId: dto.academicUnitId,
          subjectId: dto.subjectId,
        },
      },
      create: {
        examId,
        academicUnitId: dto.academicUnitId,
        subjectId: dto.subjectId,
        maxMarks: dto.maxMarks ?? 100,
        passingMarks: dto.passingMarks ?? 35,
        examDate: dto.examDate ? new Date(dto.examDate) : null,
        examTime: dto.examTime ?? null,
      },
      update: {
        maxMarks: dto.maxMarks ?? 100,
        passingMarks: dto.passingMarks ?? 35,
        examDate: dto.examDate ? new Date(dto.examDate) : null,
        examTime: dto.examTime ?? null,
      },
    });
  }

  async bulkAddSubjects(institutionId: string, examId: string, dto: BulkAddSubjectsDto) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const units = await this.prisma.academicUnit.findMany({
      where: { id: { in: dto.academicUnitIds }, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (units.length !== dto.academicUnitIds.length) {
      throw new BadRequestException('One or more academic units not found in this institution');
    }

    await this.prisma.$transaction(
      dto.academicUnitIds.map((unitId) =>
        this.prisma.examSubject.upsert({
          where: {
            examId_academicUnitId_subjectId: {
              examId,
              academicUnitId: unitId,
              subjectId: dto.subjectId,
            },
          },
          create: {
            examId,
            academicUnitId: unitId,
            subjectId: dto.subjectId,
            maxMarks: dto.maxMarks ?? 100,
            passingMarks: dto.passingMarks ?? 35,
            examDate: dto.examDate ? new Date(dto.examDate) : null,
            examTime: dto.examTime ?? null,
          },
          update: {
            maxMarks: dto.maxMarks ?? 100,
            passingMarks: dto.passingMarks ?? 35,
            examDate: dto.examDate ? new Date(dto.examDate) : null,
            examTime: dto.examTime ?? null,
          },
        }),
      ),
    );

    return { added: dto.academicUnitIds.length };
  }

  async cloneSubjects(institutionId: string, examId: string, dto: CloneSubjectsDto) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const source = await this.prisma.exam.findFirst({
      where: { id: dto.sourceExamId, institutionId, deletedAt: null },
    });
    if (!source) throw new NotFoundException('Source exam not found');

    const sourceSubjects = await this.prisma.examSubject.findMany({
      where: { examId: dto.sourceExamId },
    });
    if (sourceSubjects.length === 0) return { cloned: 0 };

    await this.prisma.$transaction(
      sourceSubjects.map((ss) =>
        this.prisma.examSubject.upsert({
          where: {
            examId_academicUnitId_subjectId: {
              examId,
              academicUnitId: ss.academicUnitId,
              subjectId: ss.subjectId,
            },
          },
          create: {
            examId,
            academicUnitId: ss.academicUnitId,
            subjectId: ss.subjectId,
            maxMarks: ss.maxMarks,
            passingMarks: ss.passingMarks,
            examDate: ss.examDate,
            examTime: ss.examTime,
          },
          update: {
            maxMarks: ss.maxMarks,
            passingMarks: ss.passingMarks,
            examDate: ss.examDate,
            examTime: ss.examTime,
          },
        }),
      ),
    );

    return { cloned: sourceSubjects.length };
  }

  async removeExamSubject(institutionId: string, examId: string, id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { id, examId, exam: { institutionId } },
      select: { id: true },
    });
    if (!examSubject) throw new NotFoundException('Exam subject not found');
    return this.prisma.examSubject.delete({ where: { id: examSubject.id } });
  }

  // ── Mark Entry ────────────────────────────────────────────────────────────

  async saveResults(institutionId: string, dto: SaveResultsDto) {
    // 1. Validate exam subject exists for this class within the same institution (M-02)
    const examSubject = await this.prisma.examSubject.findFirst({
      where: {
        examId: dto.examId,
        academicUnitId: dto.academicUnitId,
        subjectId: dto.subjectId,
        exam: { institutionId },
      },
    });
    if (!examSubject)
      throw new NotFoundException('Exam subject not found for this class');

    // 2. Validate exam is active (not draft) and not soft-deleted
    const exam = await this.prisma.exam.findFirst({
      where: { id: dto.examId, institutionId, deletedAt: null },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status !== 'active') {
      throw new BadRequestException(
        exam.status === 'draft'
          ? 'Cannot enter marks for a draft exam. Activate the exam first.'
          : 'Cannot enter marks for a completed exam.',
      );
    }

    // 3. Validate all students belong to the academic unit — prevents cross-class mark injection
    if (dto.entries.length > 0) {
      const studentIds = dto.entries.map((e) => e.studentId);
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
        throw new BadRequestException(
          'One or more students do not belong to this class',
        );
      }
    }

    // 4. Validate all marks BEFORE opening the transaction
    for (const e of dto.entries) {
      if (
        !e.isAbsent &&
        e.marksObtained !== undefined &&
        e.marksObtained > examSubject.maxMarks
      ) {
        throw new BadRequestException(
          `Marks ${e.marksObtained} exceed max marks ${examSubject.maxMarks} for this subject`,
        );
      }
    }

    // 5. Persist — all-or-nothing
    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.examResult.upsert({
          where: {
            examId_studentId_subjectId: {
              examId: dto.examId,
              studentId: e.studentId,
              subjectId: dto.subjectId,
            },
          },
          create: {
            institutionId,
            examId: dto.examId,
            studentId: e.studentId,
            subjectId: dto.subjectId,
            academicUnitId: dto.academicUnitId,
            marksObtained: e.isAbsent ? null : (e.marksObtained ?? null),
            isAbsent: e.isAbsent ?? false,
            remarks: e.remarks,
          },
          update: {
            marksObtained: e.isAbsent ? null : (e.marksObtained ?? null),
            isAbsent: e.isAbsent ?? false,
            remarks: e.remarks,
          },
        }),
      ),
    );

    return { saved: dto.entries.length };
  }

  async getResults(
    institutionId: string,
    examId: string,
    academicUnitId: string,
  ) {
    return this.prisma.examResult.findMany({
      where: { institutionId, examId, academicUnitId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            rollNo: true,
          },
        },
      },
      orderBy: [{ student: { firstName: 'asc' } }],
    });
  }

  // ── Scorecard ─────────────────────────────────────────────────────────────

  async getStudentScorecard(
    institutionId: string,
    examId: string,
    studentId: string,
    parentUserId?: string,
  ) {
    // C-06: if caller is a parent, verify the student is their linked child
    if (parentUserId) {
      const linked = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!linked)
        throw new ForbiddenException(
          'You are not authorised to view this student\'s data',
        );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        rollNo: true,
        academicUnitId: true,
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
      include: { academicYear: { select: { name: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Parents can only see scorecards for completed (officially released) exams
    if (parentUserId && exam.status !== 'completed') {
      throw new BadRequestException(
        'Results for this exam have not been released yet. Please check back after the exam is marked as completed.',
      );
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, code: true, board: true, address: true, phone: true, email: true },
    });

    const results = await this.prisma.examResult.findMany({
      where: { institutionId, examId, studentId },
    });

    const examSubjects = await this.prisma.examSubject.findMany({
      where: { examId, academicUnitId: student.academicUnitId ?? '' },
      include: { subject: true },
    });

    // Build scorecard rows
    const rows = examSubjects.map((es) => {
      const result = results.find((r) => r.subjectId === es.subjectId);
      const marks = result?.marksObtained ?? null;
      const absent = result?.isAbsent ?? false;
      const passed = absent
        ? false
        : marks !== null
          ? marks >= es.passingMarks
          : null;
      return {
        subject: es.subject.name,
        maxMarks: es.maxMarks,
        marksObtained: absent ? 'AB' : marks !== null ? marks : '—',
        passed,
        remarks: result?.remarks,
      };
    });

    const numeric = rows.filter((r) => typeof r.marksObtained === 'number');
    const totalMax = examSubjects.reduce((s, es) => s + es.maxMarks, 0);
    const totalObtained = numeric.reduce(
      (s, r) => s + (r.marksObtained as number),
      0,
    );
    const percentage =
      totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;
    const grade = this.getGrade(percentage);

    // Rank in unit
    const allStudentTotals = await this.getRankData(
      institutionId,
      examId,
      student.academicUnitId ?? '',
    );
    const rank =
      allStudentTotals.findIndex((s) => s.studentId === studentId) + 1;

    return {
      student,
      exam: {
        id: exam.id,
        name: exam.name,
        academicYear: exam.academicYear.name,
      },
      institution,
      rows,
      totalMax,
      totalObtained,
      percentage,
      grade,
      rank,
      totalStudents: allStudentTotals.length,
    };
  }

  private async getRankData(
    institutionId: string,
    examId: string,
    academicUnitId: string,
  ) {
    const results = await this.prisma.examResult.findMany({
      where: {
        institutionId,
        examId,
        academicUnitId,
        isAbsent: false,
        marksObtained: { not: null },
      },
    });

    const byStudent = new Map<string, number>();
    for (const r of results) {
      byStudent.set(
        r.studentId,
        (byStudent.get(r.studentId) ?? 0) + (r.marksObtained ?? 0),
      );
    }

    return Array.from(byStudent.entries())
      .map(([studentId, total]) => ({ studentId, total }))
      .sort((a, b) => b.total - a.total);
  }

  private getGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 75) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 35) return 'D';
    return 'F';
  }

  // ── Teacher: only their assigned exam subjects ────────────────────────────

  async getMyExamAssignments(institutionId: string, teacherUserId: string) {
    // Find unit-subjects assigned to this teacher
    const assignments = await this.prisma.academicUnitSubject.findMany({
      where: { institutionId, teacherUserId },
      select: { academicUnitId: true, subjectId: true },
    });

    if (assignments.length === 0) return [];

    // Find active exams that have exam subjects matching those assignments
    const exams = await this.prisma.exam.findMany({
      where: { institutionId, status: 'active', deletedAt: null },
      include: {
        academicYear: { select: { name: true } },
        subjects: {
          where: {
            OR: assignments.map((a) => ({
              academicUnitId: a.academicUnitId,
              subjectId: a.subjectId,
            })),
          },
          include: {
            subject: { select: { id: true, name: true } },
            academicUnit: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exams.filter((e) => e.subjects.length > 0);
  }

  // ── Completeness: marks entry progress per exam subject ───────────────────

  async getExamCompleteness(institutionId: string, examId: string) {
    // Optimised: 3 queries total instead of 1+N×2 (one student count + one result count per subject)
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { examId },
      include: {
        subject: { select: { id: true, name: true } },
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });

    const unitIds = [...new Set(examSubjects.map((es) => es.academicUnitId))];

    const [studentCounts, resultCounts] = await Promise.all([
      // Single groupBy replaces N student.count() calls
      this.prisma.student.groupBy({
        by: ['academicUnitId'],
        where: {
          institutionId,
          academicUnitId: { in: unitIds },
          deletedAt: null,
          status: 'active',
        },
        _count: { id: true },
      }),
      // Single groupBy replaces N examResult.count() calls
      this.prisma.examResult.groupBy({
        by: ['academicUnitId', 'subjectId'],
        where: { institutionId, examId },
        _count: { id: true },
      }),
    ]);

    const studentCountByUnit = new Map(
      studentCounts.map((g) => [g.academicUnitId, g._count.id]),
    );
    const resultCountByKey = new Map(
      resultCounts.map((g) => [
        `${g.academicUnitId}|${g.subjectId}`,
        g._count.id,
      ]),
    );

    const entries = examSubjects.map((es) => {
      const totalStudents = studentCountByUnit.get(es.academicUnitId) ?? 0;
      const enteredCount =
        resultCountByKey.get(`${es.academicUnitId}|${es.subjectId}`) ?? 0;
      return {
        examSubjectId: es.id,
        academicUnit: es.academicUnit,
        subject: es.subject,
        maxMarks: es.maxMarks,
        totalStudents,
        enteredCount,
        complete: totalStudents > 0 && enteredCount >= totalStudents,
      };
    });

    const totalSlots = entries.length;
    const completeSlots = entries.filter((r) => r.complete).length;

    return {
      totalSlots,
      completeSlots,
      allComplete: totalSlots > 0 && completeSlots === totalSlots,
      entries,
    };
  }

  async getClassResultSummary(
    institutionId: string,
    examId: string,
    academicUnitId: string,
  ) {
    const students = await this.prisma.student.findMany({
      where: {
        institutionId,
        academicUnitId,
        deletedAt: null,
        status: 'active',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        rollNo: true,
      },
    });

    const results = await this.prisma.examResult.findMany({
      where: { institutionId, examId, academicUnitId },
    });

    const examSubjects = await this.prisma.examSubject.findMany({
      where: { examId, academicUnitId },
      include: { subject: true },
    });

    const totalMax = examSubjects.reduce((s, es) => s + es.maxMarks, 0);

    // Build Map once — O(n) instead of O(n²) filter per student
    const resultsByStudent = new Map<string, typeof results>();
    for (const r of results) {
      if (!resultsByStudent.has(r.studentId))
        resultsByStudent.set(r.studentId, []);
      resultsByStudent.get(r.studentId)!.push(r);
    }

    const summaries = students.map((s) => {
      const myResults = resultsByStudent.get(s.id) ?? [];
      const totalObtained = myResults
        .filter((r) => !r.isAbsent && r.marksObtained !== null)
        .reduce((sum, r) => sum + (r.marksObtained ?? 0), 0);
      const percentage =
        totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
      return {
        ...s,
        totalObtained,
        totalMax,
        percentage,
        grade: this.getGrade(percentage),
      };
    });

    // Add rank
    const sorted = [...summaries].sort((a, b) => b.percentage - a.percentage);
    return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  }

  // ── Admit Card ────────────────────────────────────────────────────────────

  async getAdmitCard(
    institutionId: string,
    examId: string,
    studentId: string,
    parentUserId?: string,
  ) {
    // C-06: if caller is a parent, verify the student is their linked child
    if (parentUserId) {
      const linked = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!linked)
        throw new ForbiddenException(
          'You are not authorised to view this student\'s data',
        );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true,
        admissionNo: true, rollNo: true, dateOfBirth: true, gender: true,
        academicUnitId: true,
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId, deletedAt: null },
      include: { academicYear: { select: { name: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const subjects = await this.prisma.examSubject.findMany({
      where: { examId, academicUnitId: student.academicUnitId ?? '' },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { examDate: 'asc' },
    });

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, code: true, board: true, address: true, phone: true, email: true },
    });

    return {
      student,
      exam: {
        id: exam.id,
        name: exam.name,
        academicYear: exam.academicYear.name,
        startDate: exam.startDate,
        endDate: exam.endDate,
        examCenter: exam.examCenter,
        reportingTime: exam.reportingTime,
      },
      institution,
      subjects: subjects.map((s) => ({
        subjectName: s.subject.name,
        examDate: s.examDate,
        examTime: s.examTime,
      })),
    };
  }
}
