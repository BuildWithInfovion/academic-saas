import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto, AddExamSubjectDto, SaveResultsDto } from './dto/exam.dto';

@Injectable()
export class ExamService {
  constructor(private prisma: PrismaService) {}

  // ── Exams CRUD ────────────────────────────────────────────────────────────

  async findAll(institutionId: string, academicYearId?: string) {
    return this.prisma.exam.findMany({
      where: { institutionId, ...(academicYearId ? { academicYearId } : {}) },
      include: { academicYear: { select: { name: true } }, _count: { select: { subjects: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(institutionId: string, dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        institutionId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: 'draft',
      },
    });
  }

  async updateStatus(institutionId: string, examId: string, status: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, institutionId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.exam.update({ where: { id: examId }, data: { status } });
  }

  async delete(institutionId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, institutionId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.exam.delete({ where: { id: examId } });
  }

  // ── Exam Subjects ─────────────────────────────────────────────────────────

  async getExamSubjects(institutionId: string, examId: string) {
    // Verify exam belongs to caller's institution before returning subjects
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, institutionId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.examSubject.findMany({
      where: { examId },
      include: { subject: true, academicUnit: { select: { id: true, name: true, displayName: true } } },
      orderBy: [{ academicUnit: { name: 'asc' } }, { subject: { name: 'asc' } }],
    });
  }

  async addExamSubject(institutionId: string, examId: string, dto: AddExamSubjectDto) {
    // Verify exam belongs to caller's institution before modifying
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, institutionId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.examSubject.upsert({
      where: { examId_academicUnitId_subjectId: { examId, academicUnitId: dto.academicUnitId, subjectId: dto.subjectId } },
      create: {
        examId,
        academicUnitId: dto.academicUnitId,
        subjectId: dto.subjectId,
        maxMarks: dto.maxMarks ?? 100,
        passingMarks: dto.passingMarks ?? 35,
        examDate: dto.examDate ? new Date(dto.examDate) : null,
      },
      update: {
        maxMarks: dto.maxMarks ?? 100,
        passingMarks: dto.passingMarks ?? 35,
        examDate: dto.examDate ? new Date(dto.examDate) : null,
      },
    });
  }

  async removeExamSubject(institutionId: string, examId: string, id: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, institutionId } });
    if (!exam) throw new NotFoundException('Exam not found');
    return this.prisma.examSubject.deleteMany({ where: { id, examId } });
  }

  // ── Mark Entry ────────────────────────────────────────────────────────────

  async saveResults(institutionId: string, dto: SaveResultsDto) {
    // Validate exam subject exists
    const examSubject = await this.prisma.examSubject.findFirst({
      where: { examId: dto.examId, academicUnitId: dto.academicUnitId, subjectId: dto.subjectId },
    });
    if (!examSubject) throw new NotFoundException('Exam subject not found for this class');

    await this.prisma.$transaction(
      dto.entries.map((e) => {
        if (!e.isAbsent && e.marksObtained !== undefined && e.marksObtained > examSubject.maxMarks) {
          throw new BadRequestException(`Marks ${e.marksObtained} exceed max marks ${examSubject.maxMarks}`);
        }
        return this.prisma.examResult.upsert({
          where: { examId_studentId_subjectId: { examId: dto.examId, studentId: e.studentId, subjectId: dto.subjectId } },
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
        });
      }),
    );

    return { saved: dto.entries.length };
  }

  async getResults(institutionId: string, examId: string, academicUnitId: string) {
    return this.prisma.examResult.findMany({
      where: { institutionId, examId, academicUnitId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true } },
      },
      orderBy: [{ student: { firstName: 'asc' } }],
    });
  }

  // ── Scorecard ─────────────────────────────────────────────────────────────

  async getStudentScorecard(institutionId: string, examId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: {
        id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true, academicUnitId: true,
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, institutionId },
      include: { academicYear: { select: { name: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

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
      const passed = absent ? false : (marks !== null ? marks >= es.passingMarks : null);
      return {
        subject: es.subject.name,
        maxMarks: es.maxMarks,
        marksObtained: absent ? 'AB' : (marks !== null ? marks : '—'),
        passed,
        remarks: result?.remarks,
      };
    });

    const numeric = rows.filter((r) => typeof r.marksObtained === 'number');
    const totalMax = examSubjects.reduce((s, es) => s + es.maxMarks, 0);
    const totalObtained = numeric.reduce((s, r) => s + (r.marksObtained as number), 0);
    const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;
    const grade = this.getGrade(percentage);

    // Rank in unit
    const allStudentTotals = await this.getRankData(institutionId, examId, student.academicUnitId ?? '');
    const rank = allStudentTotals.findIndex((s) => s.studentId === studentId) + 1;

    return {
      student,
      exam: { id: exam.id, name: exam.name, academicYear: exam.academicYear.name },
      rows,
      totalMax,
      totalObtained,
      percentage,
      grade,
      rank,
      totalStudents: allStudentTotals.length,
    };
  }

  private async getRankData(institutionId: string, examId: string, academicUnitId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { institutionId, examId, academicUnitId, isAbsent: false, marksObtained: { not: null } },
    });

    const byStudent = new Map<string, number>();
    for (const r of results) {
      byStudent.set(r.studentId, (byStudent.get(r.studentId) ?? 0) + (r.marksObtained ?? 0));
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
      where: { institutionId, status: 'active' },
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
            academicUnit: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return exams.filter((e) => e.subjects.length > 0);
  }

  // ── Completeness: marks entry progress per exam subject ───────────────────

  async getExamCompleteness(institutionId: string, examId: string) {
    const examSubjects = await this.prisma.examSubject.findMany({
      where: { examId },
      include: {
        subject: { select: { id: true, name: true } },
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });

    const results = await Promise.all(
      examSubjects.map(async (es) => {
        const totalStudents = await this.prisma.student.count({
          where: { institutionId, academicUnitId: es.academicUnitId, deletedAt: null, status: 'active' },
        });
        const enteredCount = await this.prisma.examResult.count({
          where: { institutionId, examId, academicUnitId: es.academicUnitId, subjectId: es.subjectId },
        });
        return {
          examSubjectId: es.id,
          academicUnit: es.academicUnit,
          subject: es.subject,
          maxMarks: es.maxMarks,
          totalStudents,
          enteredCount,
          complete: totalStudents > 0 && enteredCount >= totalStudents,
        };
      }),
    );

    const totalSlots = results.length;
    const completeSlots = results.filter((r) => r.complete).length;

    return { totalSlots, completeSlots, allComplete: totalSlots > 0 && completeSlots === totalSlots, entries: results };
  }

  async getClassResultSummary(institutionId: string, examId: string, academicUnitId: string) {
    const students = await this.prisma.student.findMany({
      where: { institutionId, academicUnitId, deletedAt: null, status: 'active' },
      select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true },
    });

    const results = await this.prisma.examResult.findMany({
      where: { institutionId, examId, academicUnitId },
    });

    const examSubjects = await this.prisma.examSubject.findMany({
      where: { examId, academicUnitId },
      include: { subject: true },
    });

    const totalMax = examSubjects.reduce((s, es) => s + es.maxMarks, 0);

    const summaries = students.map((s) => {
      const myResults = results.filter((r) => r.studentId === s.id);
      const totalObtained = myResults
        .filter((r) => !r.isAbsent && r.marksObtained !== null)
        .reduce((sum, r) => sum + (r.marksObtained ?? 0), 0);
      const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
      return { ...s, totalObtained, totalMax, percentage, grade: this.getGrade(percentage) };
    });

    // Add rank
    const sorted = [...summaries].sort((a, b) => b.percentage - a.percentage);
    return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  }
}
