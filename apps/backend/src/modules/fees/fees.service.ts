import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto, RecordBulkPaymentDto } from './dto/fees.dto';

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
          feeStructureId: dto.feeStructureId ?? null,
          installmentName: dto.installmentName ?? null,
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

  // Returns every installment for the student's class with paid/unpaid status
  async getStudentInstallmentDues(institutionId: string, studentId: string, academicYearId: string, parentUserId?: string) {
    if (parentUserId) {
      const owned = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { academicUnitId: true, firstName: true, lastName: true, admissionNo: true },
    });
    if (!student || !student.academicUnitId) {
      return { student, installments: [], totalDue: 0, totalPaid: 0, outstanding: 0 };
    }

    const [structures, payments] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where: { institutionId, academicUnitId: student.academicUnitId, academicYearId, deletedAt: null },
        include: { feeHead: true },
        orderBy: [{ feeHead: { name: 'asc' } }, { installmentName: 'asc' }],
      }),
      this.prisma.feePayment.findMany({
        where: { institutionId, studentId, academicYearId },
        select: { feeStructureId: true, feeHeadId: true, installmentName: true, amount: true, receiptNo: true, paidOn: true, paymentMode: true },
      }),
    ]);

    // Match payments to structures by feeStructureId (new) or feeHeadId+installmentName (legacy)
    const paidByStructureId = new Map<string, number>();
    const paidByHeadInstallment = new Map<string, number>();
    for (const p of payments) {
      if (p.feeStructureId) {
        paidByStructureId.set(p.feeStructureId, (paidByStructureId.get(p.feeStructureId) ?? 0) + p.amount);
      } else {
        const key = `${p.feeHeadId}|${p.installmentName ?? ''}`;
        paidByHeadInstallment.set(key, (paidByHeadInstallment.get(key) ?? 0) + p.amount);
      }
    }

    const installments = structures.map((s) => {
      const legacyKey = `${s.feeHeadId}|${s.installmentName ?? ''}`;
      const paid = (paidByStructureId.get(s.id) ?? 0) + (paidByHeadInstallment.get(legacyKey) ?? 0);
      const due = s.amount;
      const balance = due - paid;
      return {
        feeStructureId: s.id,
        feeHeadId: s.feeHeadId,
        feeHeadName: s.feeHead.name,
        installmentName: s.installmentName ?? 'Full Year',
        dueDate: s.dueDate,
        due,
        paid,
        balance,
        status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        isOverdue: s.dueDate ? new Date() > new Date(s.dueDate) && balance > 0 : false,
      };
    });

    const totalDue = installments.reduce((s, i) => s + i.due, 0);
    const totalPaid = installments.reduce((s, i) => s + i.paid, 0);
    return { student, installments, totalDue, totalPaid, outstanding: totalDue - totalPaid };
  }

  // Collect payment for multiple installments in one shot — one receipt per installment
  async recordBulkPayments(institutionId: string, dto: RecordBulkPaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
      select: { id: true, academicUnitId: true, firstName: true, lastName: true, admissionNo: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!dto.items.length) throw new BadRequestException('No payment items provided');

    return this.prisma.$transaction(async (tx) => {
      const results: Record<string, unknown>[] = [];
      for (const item of dto.items) {
        const count = await tx.feePayment.count({ where: { institutionId } });
        const receiptNo = `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
        const payment = await tx.feePayment.create({
          data: {
            institutionId,
            studentId: dto.studentId,
            feeHeadId: item.feeHeadId,
            feeStructureId: item.feeStructureId,
            installmentName: item.installmentName,
            academicYearId: dto.academicYearId,
            amount: item.amount,
            paymentMode: dto.paymentMode,
            receiptNo,
            paidOn: new Date(dto.paidOn),
            remarks: dto.remarks,
          },
          include: { feeHead: true },
        });
        results.push(payment as unknown as Record<string, unknown>);
      }
      const totalCollected = dto.items.reduce((s, i) => s + i.amount, 0);
      return { payments: results, totalCollected, student };
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

  async getPaymentsSummary(institutionId: string) {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC+5:30

    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - istOffsetMs);
    const todayEnd   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1) - istOffsetMs);
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - istOffsetMs);

    const [todayAgg, monthAgg, currentYear, studentCount] = await Promise.all([
      this.prisma.feePayment.aggregate({
        where: { institutionId, paidOn: { gte: todayStart, lt: todayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.feePayment.aggregate({
        where: { institutionId, paidOn: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { institutionId, isCurrent: true },
        select: { id: true },
      }),
      this.prisma.student.count({
        where: { institutionId, status: 'active', deletedAt: null },
      }),
    ]);

    let totalDue = 0;
    if (currentYear) {
      const [structuresByUnit, paidAgg, students] = await Promise.all([
        this.prisma.feeStructure.groupBy({
          by: ['academicUnitId'],
          where: { institutionId, academicYearId: currentYear.id, deletedAt: null },
          _sum: { amount: true },
        }),
        this.prisma.feePayment.aggregate({
          where: { institutionId, academicYearId: currentYear.id },
          _sum: { amount: true },
        }),
        this.prisma.student.findMany({
          where: { institutionId, status: 'active', deletedAt: null },
          select: { academicUnitId: true },
        }),
      ]);
      const dueByUnit = new Map(structuresByUnit.map((s) => [s.academicUnitId, s._sum.amount ?? 0]));
      const totalFeeDue = students.reduce((sum, s) => sum + (dueByUnit.get(s.academicUnitId ?? '') ?? 0), 0);
      totalDue = Math.max(0, totalFeeDue - (paidAgg._sum.amount ?? 0));
    }

    return {
      todayTotal: todayAgg._sum.amount ?? 0,
      monthTotal: monthAgg._sum.amount ?? 0,
      totalDue,
      totalStudents: studentCount,
    };
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

  // ── Fee Due-Date Alerts (operator / accountant) ───────────────────────────

  /**
   * Returns fee installments that are overdue, due within 7 days, or due within 30 days.
   * Intended for operator/accountant dashboards only — gated by fees.read + students.read
   * so parents (who only have fees.read) cannot reach it.
   *
   * Uses IST-aware "today" so the boundary is correct for Indian schools.
   */
  async getDueAlerts(institutionId: string, academicYearId?: string) {
    // Resolve current year when not supplied
    let yearId = academicYearId;
    if (!yearId) {
      const current = await this.prisma.academicYear.findFirst({
        where: { institutionId, isCurrent: true },
        select: { id: true },
      });
      yearId = current?.id;
    }
    if (!yearId) {
      return { overdue: [], thisWeek: [], thisMonth: [], summary: { overdueCount: 0, thisWeekCount: 0, thisMonthCount: 0, overdueAmount: 0 } };
    }

    // IST-aware today: advance UTC clock by +5:30, read date, build UTC midnight for comparison
    const istMs = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(Date.now() + istMs).toISOString().slice(0, 10);
    const today     = new Date(`${todayStr}T00:00:00.000Z`);
    const weekLater  = new Date(today.getTime() + 7 * 86400000);
    const monthLater = new Date(today.getTime() + 30 * 86400000);

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        institutionId,
        academicYearId: yearId,
        dueDate: { not: null },
        deletedAt: null,
      },
      include: {
        feeHead:      { select: { id: true, name: true } },
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });

    if (structures.length === 0) {
      return { overdue: [], thisWeek: [], thisMonth: [], summary: { overdueCount: 0, thisWeekCount: 0, thisMonthCount: 0, overdueAmount: 0 } };
    }

    // Batch student counts per affected class (one query, O(1) lookup per structure)
    const classIds = [...new Set(structures.map((s) => s.academicUnitId))];
    const countRows = await this.prisma.student.groupBy({
      by: ['academicUnitId'],
      where: { institutionId, academicUnitId: { in: classIds }, deletedAt: null, status: 'active' },
      _count: { id: true },
    });
    const countByClass = new Map(countRows.map((r) => [r.academicUnitId!, r._count.id]));

    type AlertItem = {
      feeStructureId: string;
      feeHeadId: string;
      feeHeadName: string;
      installmentName: string | null;
      dueDate: string;
      daysFromToday: number;
      amount: number;
      classId: string;
      className: string;
      studentsInClass: number;
      totalAmount: number;
    };

    const overdue: AlertItem[] = [];
    const thisWeek: AlertItem[] = [];
    const thisMonth: AlertItem[] = [];

    for (const s of structures) {
      const due = s.dueDate!;
      const daysFromToday = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      const studentsInClass = countByClass.get(s.academicUnitId) ?? 0;
      const item: AlertItem = {
        feeStructureId: s.id,
        feeHeadId:     s.feeHead.id,
        feeHeadName:   s.feeHead.name,
        installmentName: s.installmentName ?? null,
        dueDate:       due.toISOString().slice(0, 10),
        daysFromToday,
        amount:        s.amount,
        classId:       s.academicUnitId,
        className:     s.academicUnit.displayName || s.academicUnit.name,
        studentsInClass,
        totalAmount:   s.amount * studentsInClass,
      };

      if (daysFromToday < 0)          overdue.push(item);
      else if (due <= weekLater)       thisWeek.push(item);
      else if (due <= monthLater)      thisMonth.push(item);
    }

    const byDate = (a: AlertItem, b: AlertItem) => a.dueDate.localeCompare(b.dueDate);
    overdue.sort(byDate);
    thisWeek.sort(byDate);
    thisMonth.sort(byDate);

    return {
      overdue,
      thisWeek,
      thisMonth,
      summary: {
        overdueCount:   overdue.length,
        thisWeekCount:  thisWeek.length,
        thisMonthCount: thisMonth.length,
        overdueAmount:  overdue.reduce((s, i) => s + i.totalAmount, 0),
      },
    };
  }

  // ── Children Upcoming Dues (parent portal) ────────────────────────────────

  /**
   * Returns upcoming + recently-overdue fee installments for a parent's linked children.
   * Window: 30 days past → 30 days ahead (enough to always show the next installment).
   * "isPaid" = child has at least one payment for that feeHead in the current academic year.
   */
  // Monthly fee collection trend — last N months (default 6) for dashboard chart
  async getMonthlyTrend(institutionId: string, months = 6) {
    const result: { month: string; label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const agg = await this.prisma.feePayment.aggregate({
        where: { institutionId, paidOn: { gte: start, lt: end } },
        _sum: { amount: true },
      });
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      result.push({ month: monthStr, label, amount: agg._sum.amount ?? 0 });
    }
    return result;
  }

  async getChildrenUpcomingDues(institutionId: string, parentUserId: string) {
    const children = await this.prisma.student.findMany({
      where: { institutionId, parentUserId, deletedAt: null, status: 'active' },
      select: {
        id: true, firstName: true, lastName: true, admissionNo: true,
        academicUnitId: true,
        academicUnit: { select: { id: true, name: true, displayName: true } },
      },
    });
    if (children.length === 0) return [];

    const currentYear = await this.prisma.academicYear.findFirst({
      where: { institutionId, isCurrent: true },
      select: { id: true },
    });
    if (!currentYear) return [];
    const yearId = currentYear.id;

    // IST today
    const istMs = 5.5 * 60 * 60 * 1000;
    const todayStr = new Date(Date.now() + istMs).toISOString().slice(0, 10);
    const today      = new Date(`${todayStr}T00:00:00.000Z`);
    const monthAgo   = new Date(today.getTime() - 30 * 86400000);
    const monthLater = new Date(today.getTime() + 30 * 86400000);

    const classIds = [...new Set(children.map((c) => c.academicUnitId).filter(Boolean))] as string[];
    if (classIds.length === 0) return [];

    // Fee structures for children's classes within the window
    const structures = await this.prisma.feeStructure.findMany({
      where: {
        institutionId,
        academicYearId: yearId,
        academicUnitId: { in: classIds },
        dueDate: { gte: monthAgo, lte: monthLater },
        deletedAt: null,
      },
      include: { feeHead: { select: { id: true, name: true } } },
    });

    if (structures.length === 0) {
      return children.map((c) => ({
        studentId: c.id,
        studentName: `${c.firstName} ${c.lastName}`,
        admissionNo: c.admissionNo,
        className: c.academicUnit?.displayName || c.academicUnit?.name || '—',
        upcomingDues: [] as never[],
      }));
    }

    // One query for all children's payments for this year
    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, studentId: { in: children.map((c) => c.id) }, academicYearId: yearId },
      select: { studentId: true, feeHeadId: true },
    });
    const paidSet = new Set(payments.map((p) => `${p.studentId}:${p.feeHeadId}`));

    return children.map((child) => {
      const childStructures = structures.filter((s) => s.academicUnitId === child.academicUnitId);
      const upcomingDues = childStructures
        .map((s) => ({
          feeHeadId:       s.feeHead.id,
          feeHeadName:     s.feeHead.name,
          installmentName: s.installmentName ?? null,
          dueDate:         s.dueDate!.toISOString().slice(0, 10),
          daysFromToday:   Math.ceil((s.dueDate!.getTime() - today.getTime()) / 86400000),
          amount:          s.amount,
          isPaid:          paidSet.has(`${child.id}:${s.feeHead.id}`),
        }))
        .sort((a, b) => a.daysFromToday - b.daysFromToday);

      return {
        studentId:   child.id,
        studentName: `${child.firstName} ${child.lastName}`,
        admissionNo: child.admissionNo,
        className:   child.academicUnit?.displayName || child.academicUnit?.name || '—',
        upcomingDues,
      };
    });
  }
}
