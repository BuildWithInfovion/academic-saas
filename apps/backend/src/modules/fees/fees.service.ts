import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto } from './dto/fees.dto';

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  // ── Fee Heads ─────────────────────────────────────────────────────────────

  async getFeeHeads(institutionId: string) {
    return this.prisma.feeHead.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createFeeHead(institutionId: string, dto: CreateFeeHeadDto) {
    try {
      return await this.prisma.feeHead.create({
        data: { institutionId, name: dto.name, isCustom: dto.isCustom ?? true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Fee head with this name already exists');
      throw e;
    }
  }

  async deleteFeeHead(institutionId: string, id: string) {
    const head = await this.prisma.feeHead.findFirst({ where: { id, institutionId, deletedAt: null } });
    if (!head) throw new NotFoundException('Fee head not found');
    return this.prisma.feeHead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Fee Structures ────────────────────────────────────────────────────────

  async getFeeStructures(institutionId: string, academicUnitId: string, academicYearId: string) {
    return this.prisma.feeStructure.findMany({
      where: { institutionId, academicUnitId, academicYearId, deletedAt: null },
      include: { feeHead: true },
      orderBy: { feeHead: { name: 'asc' } },
    });
  }

  async upsertFeeStructure(institutionId: string, dto: CreateFeeStructureDto) {
    const installmentName = dto.installmentName ?? null;
    const existing = await this.prisma.feeStructure.findFirst({
      where: { institutionId, academicUnitId: dto.academicUnitId, academicYearId: dto.academicYearId, feeHeadId: dto.feeHeadId, installmentName, deletedAt: null },
    });
    if (existing) {
      return this.prisma.feeStructure.update({
        where: { id: existing.id },
        data: { amount: dto.amount, dueDate: dto.dueDate ? new Date(dto.dueDate) : null },
      });
    }
    return this.prisma.feeStructure.create({
      data: {
        institutionId,
        academicUnitId: dto.academicUnitId,
        academicYearId: dto.academicYearId,
        feeHeadId: dto.feeHeadId,
        amount: dto.amount,
        installmentName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async deleteFeeStructure(institutionId: string, id: string) {
    const structure = await this.prisma.feeStructure.findFirst({ where: { id, institutionId, deletedAt: null } });
    if (!structure) throw new NotFoundException('Fee structure not found');
    return this.prisma.feeStructure.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async recordPayment(institutionId: string, dto: RecordPaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
      select: { id: true, academicUnitId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const feeHead = await this.prisma.feeHead.findFirst({
      where: { id: dto.feeHeadId, institutionId, deletedAt: null },
    });
    if (!feeHead) throw new NotFoundException('Fee head not found');

    // Verify a fee structure exists for this class + year + fee head
    if (student.academicUnitId && dto.academicYearId) {
      const structure = await this.prisma.feeStructure.findFirst({
        where: {
          institutionId,
          academicUnitId: student.academicUnitId,
          academicYearId: dto.academicYearId,
          feeHeadId: dto.feeHeadId,
          deletedAt: null,
        },
      });
      if (!structure) {
        throw new BadRequestException(
          'No fee structure found for this student\'s class, year, and fee head. Set up the fee structure first.',
        );
      }
    }

    // Generate receipt number inside a transaction. Advisory locks are NOT used
    // because Neon runs PgBouncer in transaction-pooling mode which rejects them
    // (P2010). Uniqueness is enforced by the DB @@unique([institutionId, receiptNo])
    // constraint; a P2002 on the rare collision is caught by the caller.
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.feePayment.count({ where: { institutionId } });
      const year = new Date().getFullYear();
      const receiptNo = `RCP-${year}-${String(count + 1).padStart(5, '0')}`;

      return tx.feePayment.create({
        data: {
          institutionId,
          studentId: dto.studentId,
          feeHeadId: dto.feeHeadId,
          academicYearId: dto.academicYearId,
          amount: dto.amount,
          paymentMode: dto.paymentMode,
          receiptNo,
          paidOn: new Date(dto.paidOn),
          remarks: dto.remarks,
        },
        include: { feeHead: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      });
    });
  }

  // C-05: parentUserId — if provided, validates the student belongs to that parent before returning data.
  async getStudentPayments(institutionId: string, studentId: string, parentUserId?: string) {
    if (parentUserId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!student) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }

    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, studentId },
      include: { feeHead: true },
      orderBy: { paidOn: 'desc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { payments, total };
  }

  // C-05: parentUserId — same ownership check.
  // C-01: Returns field names matching the frontend: totalDue, totalPaid, balance, breakdown.
  // H-03: Added deletedAt: null to feeStructure query.
  async getStudentBalance(institutionId: string, studentId: string, academicYearId: string, parentUserId?: string) {
    if (parentUserId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!student) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { academicUnitId: true },
    });
    if (!student || !student.academicUnitId) {
      return { totalDue: 0, totalPaid: 0, balance: 0, breakdown: [] };
    }

    const [structures, payments] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where: { institutionId, academicUnitId: student.academicUnitId, academicYearId, deletedAt: null },
        include: { feeHead: true },
      }),
      this.prisma.feePayment.findMany({
        where: { institutionId, studentId, academicYearId },
        select: { feeHeadId: true, amount: true },
      }),
    ]);

    // Aggregate per fee head for the breakdown table
    const byHead = new Map<string, { feeHeadName: string; due: number; paid: number }>();
    for (const s of structures) {
      const existing = byHead.get(s.feeHeadId);
      if (existing) {
        existing.due += s.amount;
      } else {
        byHead.set(s.feeHeadId, { feeHeadName: s.feeHead.name, due: s.amount, paid: 0 });
      }
    }
    for (const p of payments) {
      const entry = byHead.get(p.feeHeadId);
      if (entry) entry.paid += p.amount;
    }

    const breakdown = Array.from(byHead.values()).map((b) => ({
      feeHeadName: b.feeHeadName,
      due: b.due,
      paid: b.paid,
      balance: b.due - b.paid,
    }));

    const totalDue = breakdown.reduce((s, b) => s + b.due, 0);
    const totalPaid = breakdown.reduce((s, b) => s + b.paid, 0);

    return { totalDue, totalPaid, balance: totalDue - totalPaid, breakdown };
  }

  // M-10: Use IST-aware date range instead of exact timestamp match.
  async getDailyCollection(institutionId: string, date: string) {
    // Parse date as IST midnight → UTC range to avoid timezone drift
    const [year, month, day] = date.split('-').map(Number);
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30
    const startUtc = new Date(Date.UTC(year, month - 1, day) - istOffsetMs);
    const endUtc   = new Date(Date.UTC(year, month - 1, day + 1) - istOffsetMs);

    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, paidOn: { gte: startUtc, lt: endUtc } },
      include: {
        feeHead: true,
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { date, payments, total };
  }

  async getDefaulters(institutionId: string, academicYearId: string, academicUnitId?: string) {
    // Optimised: 3 parallel queries instead of 2+N (one aggregate per student)
    const [structures, students, paidGroups] = await Promise.all([
      // H-03: Added deletedAt: null — soft-deleted fee structures must not count as due
      this.prisma.feeStructure.findMany({
        where: { institutionId, academicYearId, deletedAt: null, ...(academicUnitId ? { academicUnitId } : {}) },
        select: { academicUnitId: true, amount: true },
      }),
      this.prisma.student.findMany({
        where: {
          institutionId,
          deletedAt: null,
          status: 'active',
          ...(academicUnitId ? { academicUnitId } : {}),
        },
        select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true },
      }),
      // Single groupBy replaces N individual aggregate() calls
      this.prisma.feePayment.groupBy({
        by: ['studentId'],
        where: { institutionId, academicYearId },
        _sum: { amount: true },
      }),
    ]);

    // Build lookup maps — O(1) access per student
    const dueByUnit = new Map<string, number>();
    for (const st of structures) {
      dueByUnit.set(st.academicUnitId, (dueByUnit.get(st.academicUnitId) ?? 0) + st.amount);
    }

    const paidByStudent = new Map<string, number>(
      paidGroups.map((g) => [g.studentId, g._sum.amount ?? 0]),
    );

    return students
      .map((s) => {
        const due = dueByUnit.get(s.academicUnitId ?? '') ?? 0;
        if (due === 0) return null;
        const paidAmount = paidByStudent.get(s.id) ?? 0;
        const balance = due - paidAmount;
        if (balance <= 0) return null;
        return { ...s, due, paid: paidAmount, balance };
      })
      .filter(Boolean);
  }

  async getPaymentById(institutionId: string, paymentId: string, parentUserId?: string) {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id: paymentId, institutionId },
      include: {
        feeHead: true,
        student: {
          select: {
            id: true,
            firstName: true, lastName: true, admissionNo: true,
            academicUnit: { select: { displayName: true, name: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // C-06: if caller is a parent, verify the payment belongs to their child
    if (parentUserId) {
      const linked = await this.prisma.student.findFirst({
        where: { id: payment.studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!linked)
        throw new ForbiddenException('You are not authorised to view this payment');
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true, board: true, address: true, phone: true, email: true },
    });

    return { ...payment, institution };
  }
}
