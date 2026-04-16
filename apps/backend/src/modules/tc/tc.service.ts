import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export class RequestTcDto {
  @IsString() @IsOptional()
  reason?: string;

  @IsString() @IsOptional()
  @IsIn(['Excellent', 'Good', 'Satisfactory', 'Poor'])
  conductGrade?: string;

  // Operator overrides — if provided, these take precedence over auto-computed values
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() religion?: string;
  @IsString() @IsOptional() casteCategory?: string;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsOptional() bloodGroup?: string;
  @IsString() @IsOptional() subjectsStudied?: string;
  @IsString() @IsOptional() lastExamName?: string;
  @IsString() @IsOptional() lastExamResult?: string;
  @IsString() @IsOptional() promotionEligible?: string;
  @IsString() @IsOptional() feesPaidUpToMonth?: string;
}

export class RejectTcDto {
  @IsString()
  remark: string;
}

@Injectable()
export class TcService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateTcNoInTx(
    tx: Prisma.TransactionClient,
    institutionId: string,
  ): Promise<string> {
    const count = await tx.transferCertificate.count({
      where: { institutionId, status: 'issued' },
    });
    const year = new Date().getFullYear();
    return `TC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // ── Request TC ────────────────────────────────────────────────────────────

  async request(
    institutionId: string,
    requestedByUserId: string,
    studentId: string,
    dto: RequestTcDto,
  ) {
    // 1. Fetch student with class info
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      include: { academicUnit: { select: { id: true, displayName: true, name: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.status === 'transferred')
      throw new BadRequestException('Student is already transferred');
    if (student.status !== 'active')
      throw new BadRequestException(
        `Student status is '${student.status}' — only active students can be issued a TC`,
      );

    // 2. Prevent duplicate in-flight requests
    const existing = await this.prisma.transferCertificate.findFirst({
      where: { institutionId, studentId, status: { in: ['pending_approval', 'approved'] } },
    });
    if (existing)
      throw new ConflictException(
        'A TC request is already in progress for this student. Approve or reject it first.',
      );

    // 3. Current academic year (for attendance + fee snapshot)
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, isCurrent: true },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    // 4. Attendance snapshot
    let workingDays = 0;
    let presentDays = 0;
    if (student.academicUnitId && currentYear) {
      workingDays = await this.prisma.attendanceSession.count({
        where: {
          academicUnitId: student.academicUnitId,
          date: { gte: currentYear.startDate, lte: currentYear.endDate },
        },
      });
      presentDays = await this.prisma.attendanceRecord.count({
        where: {
          studentId,
          status: { in: ['present', 'late'] },
          session: { date: { gte: currentYear.startDate, lte: currentYear.endDate } },
        },
      });
    }

    // 5. Subjects studied (snapshot of this class's subject list)
    let subjectsStudied: string | null = null;
    if (student.academicUnitId) {
      const unitSubjects = await this.prisma.academicUnitSubject.findMany({
        where: { academicUnitId: student.academicUnitId },
        include: { subject: { select: { name: true } } },
        orderBy: { subject: { name: 'asc' } },
      });
      if (unitSubjects.length > 0) {
        subjectsStudied = unitSubjects.map((us) => us.subject.name).join(', ');
      }
    }

    // 6. Last completed exam + pass/fail result
    let lastExamName: string | null = null;
    let lastExamResult: string | null = null;
    let promotionEligible: string | null = null;
    if (student.academicUnitId) {
      const lastExam = await this.prisma.exam.findFirst({
        where: {
          institutionId,
          ...(currentYear ? { academicYearId: currentYear.id } : {}),
          status: { not: 'draft' },
          results: { some: { studentId, academicUnitId: student.academicUnitId } },
        },
        include: {
          subjects: { where: { academicUnitId: student.academicUnitId } },
          results: { where: { studentId, academicUnitId: student.academicUnitId } },
        },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      });

      if (lastExam && lastExam.results.length > 0) {
        lastExamName = currentYear
          ? `${lastExam.name} (${currentYear.name})`
          : lastExam.name;

        const passingMap = new Map(
          lastExam.subjects.map((s) => [s.subjectId, s.passingMarks]),
        );
        const allPassed = lastExam.results.every((r) => {
          if (r.isAbsent) return false;
          if (r.marksObtained === null || r.marksObtained === undefined) return false;
          return r.marksObtained >= (passingMap.get(r.subjectId) ?? 35);
        });
        lastExamResult   = allPassed ? 'Pass' : 'Fail';
        promotionEligible = allPassed ? 'Yes'  : 'No';
      } else {
        lastExamResult   = 'N/A';
        promotionEligible = 'N/A';
      }
    }

    // 7. Fees paid up to month — government TC field
    //    We show the month of the most recent payment, or "N/A" if no payments exist.
    let feesPaidUpToMonth: string | null = 'N/A';
    const lastPayment = await this.prisma.feePayment.findFirst({
      where: { institutionId, studentId },
      orderBy: { paidOn: 'desc' },
      select: { paidOn: true },
    });
    if (lastPayment) {
      feesPaidUpToMonth = new Date(lastPayment.paidOn).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
    }

    // 8. Fee dues check (workflow flag — not printed on TC)
    let hasDues = false;
    let duesRemark: string | null = null;
    if (student.academicUnitId && currentYear) {
      const structures = await this.prisma.feeStructure.findMany({
        where: {
          institutionId,
          academicUnitId: student.academicUnitId,
          academicYearId: currentYear.id,
          deletedAt: null,
        },
      });
      const totalDue = structures.reduce((s, f) => s + f.amount, 0);
      if (totalDue > 0) {
        const agg = await this.prisma.feePayment.aggregate({
          where: { institutionId, studentId, academicYearId: currentYear.id },
          _sum: { amount: true },
        });
        const totalPaid = agg._sum.amount ?? 0;
        if (totalDue > totalPaid) {
          hasDues = true;
          const outstanding = totalDue - totalPaid;
          duesRemark = `Outstanding ₹${outstanding.toFixed(2)} for ${currentYear.name}`;
        }
      }
    }

    // 9. Create TC request with full student snapshot
    const classLastStudied =
      student.academicUnit?.displayName || student.academicUnit?.name || 'N/A';

    return this.prisma.transferCertificate.create({
      data: {
        institutionId,
        studentId,
        status: 'pending_approval',
        // Student snapshot — immutable; operator overrides take precedence over auto-fetched values
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        dateOfBirth: student.dateOfBirth,
        gender:          dto.gender          ?? student.gender,
        fatherName:      student.fatherName,
        motherName:      student.motherName,
        nationality:     dto.nationality     ?? student.nationality,
        religion:        dto.religion        ?? student.religion,
        casteCategory:   dto.casteCategory   ?? student.casteCategory,
        bloodGroup:      dto.bloodGroup      ?? student.bloodGroup,
        classLastStudied,
        admissionDate: student.admissionDate,
        academicYearName: currentYear?.name ?? null,
        // Academic snapshot (operator overrides take precedence)
        subjectsStudied:  dto.subjectsStudied  ?? subjectsStudied,
        lastExamName:     dto.lastExamName     ?? lastExamName,
        lastExamResult:   dto.lastExamResult   ?? lastExamResult,
        promotionEligible: dto.promotionEligible ?? promotionEligible,
        // Fee snapshot (operator override takes precedence)
        feesPaidUpToMonth: dto.feesPaidUpToMonth ?? feesPaidUpToMonth,
        // TC fields
        conductGrade: dto.conductGrade ?? 'Good',
        reason: dto.reason ?? null,
        // Attendance snapshot
        workingDays,
        presentDays,
        // Dues check (workflow)
        hasDues,
        duesRemark,
        requestedByUserId,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      },
    });
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(institutionId: string, status?: string, studentId?: string) {
    return this.prisma.transferCertificate.findMany({
      where: {
        institutionId,
        ...(status ? { status } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            academicUnit: { select: { displayName: true, name: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  async findOne(institutionId: string, id: string) {
    const tc = await this.prisma.transferCertificate.findFirst({
      where: { id, institutionId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            academicUnit: { select: { displayName: true, name: true } },
          },
        },
        institution: {
          select: { name: true, code: true, board: true, address: true, phone: true, email: true },
        },
      },
    });
    if (!tc) throw new NotFoundException('Transfer certificate not found');
    return tc;
  }

  // ── Approve ───────────────────────────────────────────────────────────────

  async approve(institutionId: string, approvedByUserId: string, id: string) {
    const tc = await this.prisma.transferCertificate.findFirst({ where: { id, institutionId } });
    if (!tc) throw new NotFoundException('Transfer certificate not found');
    if (tc.status !== 'pending_approval')
      throw new BadRequestException(`Cannot approve a TC with status '${tc.status}'`);

    return this.prisma.transferCertificate.update({
      where: { id },
      data: { status: 'approved', approvedByUserId, approvedAt: new Date() },
    });
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  async reject(institutionId: string, rejectedByUserId: string, id: string, remark: string) {
    const tc = await this.prisma.transferCertificate.findFirst({ where: { id, institutionId } });
    if (!tc) throw new NotFoundException('Transfer certificate not found');
    if (tc.status !== 'pending_approval')
      throw new BadRequestException(`Cannot reject a TC with status '${tc.status}'`);

    return this.prisma.transferCertificate.update({
      where: { id },
      data: { status: 'rejected', rejectedByUserId, rejectionRemark: remark, rejectedAt: new Date() },
    });
  }

  // ── Issue ─────────────────────────────────────────────────────────────────
  // Atomically: generate TC number, mark TC as issued, mark student as transferred.

  async issue(institutionId: string, id: string) {
    const tc = await this.prisma.transferCertificate.findFirst({ where: { id, institutionId } });
    if (!tc) throw new NotFoundException('Transfer certificate not found');
    if (tc.status !== 'approved')
      throw new BadRequestException(
        `TC must be approved before issuing. Current status: '${tc.status}'`,
      );

    return this.prisma.$transaction(async (tx) => {
      const tcNumber = await this.generateTcNoInTx(tx, institutionId);
      const issued = await tx.transferCertificate.update({
        where: { id },
        data: { status: 'issued', tcNumber, issuedAt: new Date() },
        include: {
          institution: {
            select: { name: true, code: true, board: true, address: true, phone: true, email: true },
          },
        },
      });
      await tx.student.update({
        where: { id: tc.studentId },
        data: { status: 'transferred' },
      });
      return issued;
    });
  }
}
