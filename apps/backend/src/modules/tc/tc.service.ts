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

    // 5. Fee dues check
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

    // 6. Create TC request with student snapshot
    const classLastStudied =
      student.academicUnit?.displayName || student.academicUnit?.name || 'N/A';

    return this.prisma.transferCertificate.create({
      data: {
        institutionId,
        studentId,
        status: 'pending_approval',
        // Student snapshot — captured now; independent of future record changes
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        fatherName: student.fatherName,
        motherName: student.motherName,
        nationality: student.nationality,
        religion: student.religion,
        casteCategory: student.casteCategory,
        bloodGroup: student.bloodGroup,
        classLastStudied,
        admissionDate: student.admissionDate,
        academicYearName: currentYear?.name ?? null,
        // TC fields
        conductGrade: dto.conductGrade ?? 'Good',
        reason: dto.reason ?? null,
        // Snapshots
        workingDays,
        presentDays,
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
