import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto, RecordBulkPaymentDto,
  CreateFeeCategoryDto, CreateFeePlanDto, UpdateFeePlanDto,
  AddFeePlanItemDto, UpdateFeePlanItemDto,
  AddFeePlanInstallmentDto, UpdateFeePlanInstallmentDto,
  AssignClassesDto, CopyFeePlanDto, AddConcessionDto, RecordCollectionDto,
} from './dto/fees.dto';

const IST_MS = 5.5 * 60 * 60 * 1000;

function istToday(): Date {
  const str = new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
}

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY — FeeHead / FeeStructure / FeePayment (kept for backward compat)
  // ═══════════════════════════════════════════════════════════════════════════

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
      data: { institutionId, academicUnitId: dto.academicUnitId, academicYearId: dto.academicYearId, feeHeadId: dto.feeHeadId, amount: dto.amount, installmentName, dueDate: dto.dueDate ? new Date(dto.dueDate) : null },
    });
  }

  async deleteFeeStructure(institutionId: string, id: string) {
    const structure = await this.prisma.feeStructure.findFirst({ where: { id, institutionId, deletedAt: null } });
    if (!structure) throw new NotFoundException('Fee structure not found');
    return this.prisma.feeStructure.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async recordPayment(institutionId: string, dto: RecordPaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
      select: { id: true, academicUnitId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const feeHead = await this.prisma.feeHead.findFirst({ where: { id: dto.feeHeadId, institutionId, deletedAt: null } });
    if (!feeHead) throw new NotFoundException('Fee head not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const count = await tx.feePayment.count({ where: { institutionId } });
        const year = new Date().getFullYear();
        const receiptNo = `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
        return tx.feePayment.create({
          data: { institutionId, studentId: dto.studentId, feeHeadId: dto.feeHeadId, feeStructureId: dto.feeStructureId ?? null, installmentName: dto.installmentName ?? null, academicYearId: dto.academicYearId, amount: dto.amount, paymentMode: dto.paymentMode, receiptNo, paidOn: new Date(dto.paidOn), remarks: dto.remarks },
          include: { feeHead: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        });
      }, { timeout: 15000, maxWait: 10000 });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Receipt number conflict — please retry');
      throw e;
    }
  }

  async recordBulkPayments(institutionId: string, dto: RecordBulkPaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
      select: { id: true, academicUnitId: true, firstName: true, lastName: true, admissionNo: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!dto.items.length) throw new BadRequestException('No payment items provided');
    return this.prisma.$transaction(async (tx) => {
      const results: Record<string, unknown>[] = [];
      const baseCount = await tx.feePayment.count({ where: { institutionId } });
      const rcpYear = new Date().getFullYear();
      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const receiptNo = `RCP-${rcpYear}-${String(baseCount + i + 1).padStart(5, '0')}`;
        const payment = await tx.feePayment.create({
          data: { institutionId, studentId: dto.studentId, feeHeadId: item.feeHeadId, feeStructureId: item.feeStructureId, installmentName: item.installmentName, academicYearId: dto.academicYearId, amount: item.amount, paymentMode: dto.paymentMode, receiptNo, paidOn: new Date(dto.paidOn), remarks: dto.remarks },
          include: { feeHead: true },
        });
        results.push(payment as unknown as Record<string, unknown>);
      }
      return { payments: results, totalCollected: dto.items.reduce((s, i) => s + i.amount, 0), student };
    }, { timeout: 15000, maxWait: 10000 });
  }

  async getStudentInstallmentDues(institutionId: string, studentId: string, academicYearId: string, parentUserId?: string) {
    if (parentUserId) {
      const owned = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!owned) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }
    const student = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, deletedAt: null }, select: { academicUnitId: true, firstName: true, lastName: true, admissionNo: true } });
    if (!student || !student.academicUnitId) return { student, installments: [], totalDue: 0, totalPaid: 0, outstanding: 0 };
    const [structures, payments] = await Promise.all([
      this.prisma.feeStructure.findMany({ where: { institutionId, academicUnitId: student.academicUnitId, academicYearId, deletedAt: null }, include: { feeHead: true }, orderBy: [{ feeHead: { name: 'asc' } }, { installmentName: 'asc' }] }),
      this.prisma.feePayment.findMany({ where: { institutionId, studentId, academicYearId }, select: { feeStructureId: true, feeHeadId: true, installmentName: true, amount: true } }),
    ]);
    const paidByStructureId = new Map<string, number>();
    const paidByHeadInstallment = new Map<string, number>();
    for (const p of payments) {
      if (p.feeStructureId) paidByStructureId.set(p.feeStructureId, (paidByStructureId.get(p.feeStructureId) ?? 0) + p.amount);
      else { const key = `${p.feeHeadId}|${p.installmentName ?? ''}`; paidByHeadInstallment.set(key, (paidByHeadInstallment.get(key) ?? 0) + p.amount); }
    }
    const installments = structures.map((s) => {
      const legacyKey = `${s.feeHeadId}|${s.installmentName ?? ''}`;
      const paid = (paidByStructureId.get(s.id) ?? 0) + (paidByHeadInstallment.get(legacyKey) ?? 0);
      const due = s.amount; const balance = due - paid;
      return { feeStructureId: s.id, feeHeadId: s.feeHeadId, feeHeadName: s.feeHead.name, installmentName: s.installmentName ?? 'Full Year', dueDate: s.dueDate, due, paid, balance, status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid', isOverdue: s.dueDate ? new Date() > new Date(s.dueDate) && balance > 0 : false };
    });
    const totalDue = installments.reduce((s, i) => s + i.due, 0);
    const totalPaid = installments.reduce((s, i) => s + i.paid, 0);
    return { student, installments, totalDue, totalPaid, outstanding: totalDue - totalPaid };
  }

  async getStudentPayments(institutionId: string, studentId: string, parentUserId?: string) {
    if (parentUserId) {
      const student = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!student) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }
    const payments = await this.prisma.feePayment.findMany({ where: { institutionId, studentId }, include: { feeHead: true }, orderBy: { paidOn: 'desc' } });
    return { payments, total: payments.reduce((sum, p) => sum + p.amount, 0) };
  }

  async getStudentBalance(institutionId: string, studentId: string, academicYearId: string, parentUserId?: string) {
    if (parentUserId) {
      const student = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!student) throw new ForbiddenException('You are not authorised to view this student\'s data');
    }
    const student = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, deletedAt: null }, select: { academicUnitId: true } });
    if (!student || !student.academicUnitId) return { totalDue: 0, totalPaid: 0, balance: 0, breakdown: [] };
    const [structures, payments] = await Promise.all([
      this.prisma.feeStructure.findMany({ where: { institutionId, academicUnitId: student.academicUnitId, academicYearId, deletedAt: null }, include: { feeHead: true } }),
      this.prisma.feePayment.findMany({ where: { institutionId, studentId, academicYearId }, select: { feeHeadId: true, amount: true } }),
    ]);
    const byHead = new Map<string, { feeHeadName: string; due: number; paid: number }>();
    for (const s of structures) { const ex = byHead.get(s.feeHeadId); if (ex) ex.due += s.amount; else byHead.set(s.feeHeadId, { feeHeadName: s.feeHead.name, due: s.amount, paid: 0 }); }
    for (const p of payments) { const e = byHead.get(p.feeHeadId); if (e) e.paid += p.amount; }
    const breakdown = Array.from(byHead.values()).map((b) => ({ feeHeadName: b.feeHeadName, due: b.due, paid: b.paid, balance: b.due - b.paid }));
    const totalDue = breakdown.reduce((s, b) => s + b.due, 0);
    const totalPaid = breakdown.reduce((s, b) => s + b.paid, 0);
    return { totalDue, totalPaid, balance: totalDue - totalPaid, breakdown };
  }

  async getDailyCollection(institutionId: string, date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const startUtc = new Date(Date.UTC(year, month - 1, day) - IST_MS);
    const endUtc   = new Date(Date.UTC(year, month - 1, day + 1) - IST_MS);
    const [legacyPayments, v2Collections] = await Promise.all([
      this.prisma.feePayment.findMany({ where: { institutionId, paidOn: { gte: startUtc, lt: endUtc } }, include: { feeHead: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.feeCollection.findMany({ where: { institutionId, paidOn: { gte: startUtc, lt: endUtc } }, include: { feeCategory: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const legacyMapped = legacyPayments.map((p) => ({ id: p.id, receiptNo: p.receiptNo, amount: p.amount, paymentMode: p.paymentMode, paidOn: p.paidOn, categoryName: p.feeHead.name, student: p.student, source: 'legacy' as const }));
    const v2Mapped = v2Collections.map((c) => ({ id: c.id, receiptNo: c.receiptNo, amount: c.amount, paymentMode: c.paymentMode, paidOn: c.paidOn, categoryName: c.feeCategory.name, student: c.student, source: 'v2' as const }));
    const all = [...legacyMapped, ...v2Mapped].sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime());
    return { date, payments: all, total: all.reduce((s, p) => s + p.amount, 0) };
  }

  async getPaymentsSummary(institutionId: string) {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - IST_MS);
    const todayEnd   = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1) - IST_MS);
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1) - IST_MS);
    const [todayLegacy, todayV2, monthLegacy, monthV2, studentCount] = await Promise.all([
      this.prisma.feePayment.aggregate({ where: { institutionId, paidOn: { gte: todayStart, lt: todayEnd } }, _sum: { amount: true } }),
      this.prisma.feeCollection.aggregate({ where: { institutionId, paidOn: { gte: todayStart, lt: todayEnd } }, _sum: { amount: true } }),
      this.prisma.feePayment.aggregate({ where: { institutionId, paidOn: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.feeCollection.aggregate({ where: { institutionId, paidOn: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.student.count({ where: { institutionId, status: 'active', deletedAt: null } }),
    ]);
    const todayTotal = (todayLegacy._sum.amount ?? 0) + (todayV2._sum.amount ?? 0);
    const monthTotal = (monthLegacy._sum.amount ?? 0) + (monthV2._sum.amount ?? 0);
    return { todayTotal, monthTotal, totalStudents: studentCount, totalDue: 0 };
  }

  async getDefaulters(institutionId: string, academicYearId: string, academicUnitId?: string) {
    const [structures, students, paidGroups] = await Promise.all([
      this.prisma.feeStructure.findMany({ where: { institutionId, academicYearId, deletedAt: null, ...(academicUnitId ? { academicUnitId } : {}) }, select: { academicUnitId: true, amount: true } }),
      this.prisma.student.findMany({ where: { institutionId, deletedAt: null, status: 'active', ...(academicUnitId ? { academicUnitId } : {}) }, select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true } }),
      this.prisma.feePayment.groupBy({ by: ['studentId'], where: { institutionId, academicYearId }, _sum: { amount: true } }),
    ]);
    const dueByUnit = new Map<string, number>();
    for (const st of structures) dueByUnit.set(st.academicUnitId, (dueByUnit.get(st.academicUnitId) ?? 0) + st.amount);
    const paidByStudent = new Map<string, number>(paidGroups.map((g) => [g.studentId, g._sum.amount ?? 0]));
    return students.map((s) => {
      const due = dueByUnit.get(s.academicUnitId ?? '') ?? 0;
      if (due === 0) return null;
      const paidAmount = paidByStudent.get(s.id) ?? 0;
      const balance = due - paidAmount;
      if (balance <= 0) return null;
      return { ...s, due, paid: paidAmount, balance };
    }).filter(Boolean);
  }

  async getPaymentById(institutionId: string, paymentId: string, parentUserId?: string) {
    const payment = await this.prisma.feePayment.findFirst({ where: { id: paymentId, institutionId }, include: { feeHead: true, student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnit: { select: { displayName: true, name: true } } } } } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (parentUserId) {
      const linked = await this.prisma.student.findFirst({ where: { id: payment.studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!linked) throw new ForbiddenException('You are not authorised to view this payment');
    }
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true, board: true, address: true, phone: true, email: true, logoUrl: true, principalName: true, tagline: true, affiliationNo: true } });
    return { ...payment, institution };
  }

  async getDueAlerts(institutionId: string, academicYearId?: string) {
    let yearId = academicYearId;
    if (!yearId) { const current = await this.prisma.academicYear.findFirst({ where: { institutionId, isCurrent: true }, select: { id: true } }); yearId = current?.id; }
    if (!yearId) return { overdue: [], thisWeek: [], thisMonth: [], summary: { overdueCount: 0, thisWeekCount: 0, thisMonthCount: 0, overdueAmount: 0 } };
    const today = istToday();
    const weekLater = new Date(today.getTime() + 7 * 86400000);
    const monthLater = new Date(today.getTime() + 30 * 86400000);
    const structures = await this.prisma.feeStructure.findMany({ where: { institutionId, academicYearId: yearId, dueDate: { not: null }, deletedAt: null }, include: { feeHead: { select: { id: true, name: true } }, academicUnit: { select: { id: true, name: true, displayName: true } } } });
    if (structures.length === 0) return { overdue: [], thisWeek: [], thisMonth: [], summary: { overdueCount: 0, thisWeekCount: 0, thisMonthCount: 0, overdueAmount: 0 } };
    const classIds = [...new Set(structures.map((s) => s.academicUnitId))];
    const countRows = await this.prisma.student.groupBy({ by: ['academicUnitId'], where: { institutionId, academicUnitId: { in: classIds }, deletedAt: null, status: 'active' }, _count: { id: true } });
    const countByClass = new Map(countRows.map((r) => [r.academicUnitId!, r._count.id]));
    type AlertItem = { feeStructureId: string; feeHeadId: string; feeHeadName: string; installmentName: string | null; dueDate: string; daysFromToday: number; amount: number; classId: string; className: string; studentsInClass: number; totalAmount: number };
    const overdue: AlertItem[] = [], thisWeek: AlertItem[] = [], thisMonth: AlertItem[] = [];
    for (const s of structures) {
      const due = s.dueDate!;
      const daysFromToday = Math.ceil((due.getTime() - today.getTime()) / 86400000);
      const studentsInClass = countByClass.get(s.academicUnitId) ?? 0;
      const item: AlertItem = { feeStructureId: s.id, feeHeadId: s.feeHead.id, feeHeadName: s.feeHead.name, installmentName: s.installmentName ?? null, dueDate: due.toISOString().slice(0, 10), daysFromToday, amount: s.amount, classId: s.academicUnitId, className: s.academicUnit.displayName || s.academicUnit.name, studentsInClass, totalAmount: s.amount * studentsInClass };
      if (daysFromToday < 0) overdue.push(item);
      else if (due <= weekLater) thisWeek.push(item);
      else if (due <= monthLater) thisMonth.push(item);
    }
    const byDate = (a: AlertItem, b: AlertItem) => a.dueDate.localeCompare(b.dueDate);
    overdue.sort(byDate); thisWeek.sort(byDate); thisMonth.sort(byDate);
    return { overdue, thisWeek, thisMonth, summary: { overdueCount: overdue.length, thisWeekCount: thisWeek.length, thisMonthCount: thisMonth.length, overdueAmount: overdue.reduce((s, i) => s + i.totalAmount, 0) } };
  }

  async getMonthlyTrend(institutionId: string, months = 6) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [legacyPayments, v2Collections] = await Promise.all([
      this.prisma.feePayment.findMany({ where: { institutionId, paidOn: { gte: start, lt: end } }, select: { paidOn: true, amount: true } }),
      this.prisma.feeCollection.findMany({ where: { institutionId, paidOn: { gte: start, lt: end } }, select: { paidOn: true, amount: true } }),
    ]);
    const amountByMonth = new Map<string, number>();
    for (const p of [...legacyPayments, ...v2Collections]) {
      const d = new Date(p.paidOn);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      amountByMonth.set(key, (amountByMonth.get(key) ?? 0) + p.amount);
    }
    const result: { month: string; label: string; amount: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      result.push({ month: monthStr, label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), amount: amountByMonth.get(monthStr) ?? 0 });
    }
    return result;
  }

  async getChildrenUpcomingDues(institutionId: string, parentUserId: string) {
    const children = await this.prisma.student.findMany({ where: { institutionId, parentUserId, deletedAt: null, status: 'active' }, select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true, academicUnit: { select: { id: true, name: true, displayName: true } } } });
    if (children.length === 0) return [];
    const currentYear = await this.prisma.academicYear.findFirst({ where: { institutionId, isCurrent: true }, select: { id: true } });
    if (!currentYear) return [];
    const yearId = currentYear.id;
    const today = istToday();
    const monthAgo = new Date(today.getTime() - 30 * 86400000);
    const monthLater = new Date(today.getTime() + 30 * 86400000);
    const classIds = [...new Set(children.map((c) => c.academicUnitId).filter(Boolean))] as string[];
    if (classIds.length === 0) return [];
    const structures = await this.prisma.feeStructure.findMany({ where: { institutionId, academicYearId: yearId, academicUnitId: { in: classIds }, dueDate: { gte: monthAgo, lte: monthLater }, deletedAt: null }, include: { feeHead: { select: { id: true, name: true } } } });
    if (structures.length === 0) return children.map((c) => ({ studentId: c.id, studentName: `${c.firstName} ${c.lastName}`, admissionNo: c.admissionNo, className: c.academicUnit?.displayName || c.academicUnit?.name || '—', upcomingDues: [] as never[] }));
    const payments = await this.prisma.feePayment.findMany({ where: { institutionId, studentId: { in: children.map((c) => c.id) }, academicYearId: yearId }, select: { studentId: true, feeHeadId: true } });
    const paidSet = new Set(payments.map((p) => `${p.studentId}:${p.feeHeadId}`));
    return children.map((child) => {
      const childStructures = structures.filter((s) => s.academicUnitId === child.academicUnitId);
      const upcomingDues = childStructures.map((s) => ({ feeHeadId: s.feeHead.id, feeHeadName: s.feeHead.name, installmentName: s.installmentName ?? null, dueDate: s.dueDate!.toISOString().slice(0, 10), daysFromToday: Math.ceil((s.dueDate!.getTime() - today.getTime()) / 86400000), amount: s.amount, isPaid: paidSet.has(`${child.id}:${s.feeHead.id}`) })).sort((a, b) => a.daysFromToday - b.daysFromToday);
      return { studentId: child.id, studentName: `${child.firstName} ${child.lastName}`, admissionNo: child.admissionNo, className: child.academicUnit?.displayName || child.academicUnit?.name || '—', upcomingDues };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Fee Categories
  // ═══════════════════════════════════════════════════════════════════════════

  async getCategories(institutionId: string) {
    return this.prisma.feeCategory.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(institutionId: string, dto: CreateFeeCategoryDto) {
    try {
      return await this.prisma.feeCategory.create({
        data: { institutionId, name: dto.name, type: dto.type ?? 'CUSTOM' },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Category with this name already exists');
      throw e;
    }
  }

  async deleteCategory(institutionId: string, id: string) {
    const cat = await this.prisma.feeCategory.findFirst({ where: { id, institutionId, deletedAt: null } });
    if (!cat) throw new NotFoundException('Category not found');
    const inUse = await this.prisma.feePlanItem.count({ where: { feeCategoryId: id } });
    if (inUse > 0) throw new BadRequestException('Category is used in fee plans and cannot be deleted');
    return this.prisma.feeCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Fee Plans
  // ═══════════════════════════════════════════════════════════════════════════

  async getFeePlans(institutionId: string, academicYearId?: string) {
    return this.prisma.feePlan.findMany({
      where: { institutionId, deletedAt: null, ...(academicYearId ? { academicYearId } : {}) },
      include: {
        academicYear: { select: { id: true, name: true } },
        items: {
          include: {
            feeCategory: true,
            installments: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
          },
        },
        classMaps: { include: { academicUnit: { select: { id: true, name: true, displayName: true } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getFeePlan(institutionId: string, planId: string) {
    const plan = await this.prisma.feePlan.findFirst({
      where: { id: planId, institutionId, deletedAt: null },
      include: {
        academicYear: { select: { id: true, name: true } },
        items: {
          include: {
            feeCategory: true,
            installments: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
          },
        },
        classMaps: { include: { academicUnit: { select: { id: true, name: true, displayName: true } } } },
      },
    });
    if (!plan) throw new NotFoundException('Fee plan not found');
    return plan;
  }

  async createFeePlan(institutionId: string, dto: CreateFeePlanDto) {
    try {
      return await this.prisma.feePlan.create({
        data: { institutionId, academicYearId: dto.academicYearId, name: dto.name, description: dto.description },
        include: { academicYear: { select: { id: true, name: true } }, items: true, classMaps: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('A plan with this name already exists for this academic year');
      throw e;
    }
  }

  async updateFeePlan(institutionId: string, planId: string, dto: UpdateFeePlanDto) {
    const plan = await this.prisma.feePlan.findFirst({ where: { id: planId, institutionId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Fee plan not found');
    return this.prisma.feePlan.update({ where: { id: planId }, data: { name: dto.name, description: dto.description, isActive: dto.isActive } });
  }

  async deleteFeePlan(institutionId: string, planId: string) {
    const plan = await this.prisma.feePlan.findFirst({ where: { id: planId, institutionId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Fee plan not found');
    return this.prisma.feePlan.update({ where: { id: planId }, data: { deletedAt: new Date() } });
  }

  async copyFeePlan(institutionId: string, planId: string, dto: CopyFeePlanDto) {
    const source = await this.getFeePlan(institutionId, planId);
    const newName = dto.newName ?? `${source.name} (Copy)`;
    return this.prisma.$transaction(async (tx) => {
      const newPlan = await tx.feePlan.create({
        data: { institutionId, academicYearId: dto.targetAcademicYearId, name: newName, description: source.description },
      });
      for (const item of source.items) {
        const newItem = await tx.feePlanItem.create({
          data: { feePlanId: newPlan.id, feeCategoryId: item.feeCategoryId, totalAmount: item.totalAmount },
        });
        for (const inst of item.installments) {
          await tx.feePlanInstallment.create({
            data: { feePlanItemId: newItem.id, label: inst.label, amount: inst.amount, dueDate: inst.dueDate, sortOrder: inst.sortOrder },
          });
        }
      }
      return tx.feePlan.findUnique({ where: { id: newPlan.id }, include: { academicYear: { select: { id: true, name: true } }, items: { include: { feeCategory: true, installments: { orderBy: [{ sortOrder: 'asc' }] } } }, classMaps: true } });
    }, { timeout: 15000, maxWait: 10000 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Plan Items
  // ═══════════════════════════════════════════════════════════════════════════

  async addPlanItem(institutionId: string, planId: string, dto: AddFeePlanItemDto) {
    await this.prisma.feePlan.findFirst({ where: { id: planId, institutionId, deletedAt: null } }).then((p) => { if (!p) throw new NotFoundException('Fee plan not found'); });
    try {
      return await this.prisma.feePlanItem.create({
        data: { feePlanId: planId, feeCategoryId: dto.feeCategoryId, totalAmount: dto.totalAmount },
        include: { feeCategory: true, installments: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('This category is already in the plan');
      throw e;
    }
  }

  async updatePlanItem(institutionId: string, planId: string, itemId: string, dto: UpdateFeePlanItemDto) {
    const item = await this.prisma.feePlanItem.findFirst({ where: { id: itemId, feePlanId: planId, feePlan: { institutionId } } });
    if (!item) throw new NotFoundException('Plan item not found');
    return this.prisma.feePlanItem.update({ where: { id: itemId }, data: { totalAmount: dto.totalAmount } });
  }

  async deletePlanItem(institutionId: string, planId: string, itemId: string) {
    const item = await this.prisma.feePlanItem.findFirst({ where: { id: itemId, feePlanId: planId, feePlan: { institutionId } } });
    if (!item) throw new NotFoundException('Plan item not found');
    const hasCollections = await this.prisma.feeCollection.count({ where: { feePlanItemId: itemId } });
    if (hasCollections > 0) throw new BadRequestException('Cannot delete an item that has fee collections recorded against it');
    return this.prisma.feePlanItem.delete({ where: { id: itemId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Plan Installments
  // ═══════════════════════════════════════════════════════════════════════════

  async addInstallment(institutionId: string, planId: string, itemId: string, dto: AddFeePlanInstallmentDto) {
    const item = await this.prisma.feePlanItem.findFirst({ where: { id: itemId, feePlanId: planId, feePlan: { institutionId } } });
    if (!item) throw new NotFoundException('Plan item not found');
    try {
      return await this.prisma.feePlanInstallment.create({
        data: { feePlanItemId: itemId, label: dto.label, amount: dto.amount, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, sortOrder: dto.sortOrder ?? 0 },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('An installment with this label already exists');
      throw e;
    }
  }

  async updateInstallment(institutionId: string, planId: string, itemId: string, installmentId: string, dto: UpdateFeePlanInstallmentDto) {
    const inst = await this.prisma.feePlanInstallment.findFirst({ where: { id: installmentId, feePlanItemId: itemId, feePlanItem: { feePlanId: planId, feePlan: { institutionId } } } });
    if (!inst) throw new NotFoundException('Installment not found');
    return this.prisma.feePlanInstallment.update({
      where: { id: installmentId },
      data: { label: dto.label, amount: dto.amount, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, sortOrder: dto.sortOrder },
    });
  }

  async deleteInstallment(institutionId: string, planId: string, itemId: string, installmentId: string) {
    const inst = await this.prisma.feePlanInstallment.findFirst({ where: { id: installmentId, feePlanItemId: itemId, feePlanItem: { feePlanId: planId, feePlan: { institutionId } } } });
    if (!inst) throw new NotFoundException('Installment not found');
    const hasCollections = await this.prisma.feeCollection.count({ where: { feePlanInstallmentId: installmentId } });
    if (hasCollections > 0) throw new BadRequestException('Cannot delete an installment that has collections recorded against it');
    return this.prisma.feePlanInstallment.delete({ where: { id: installmentId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Class Assignment
  // ═══════════════════════════════════════════════════════════════════════════

  async assignClassesToPlan(institutionId: string, planId: string, dto: AssignClassesDto) {
    const plan = await this.prisma.feePlan.findFirst({ where: { id: planId, institutionId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Fee plan not found');
    // Remove existing maps and replace with new set
    await this.prisma.feePlanClassMap.deleteMany({ where: { feePlanId: planId } });
    if (dto.academicUnitIds.length === 0) return [];
    const maps = await this.prisma.$transaction(
      dto.academicUnitIds.map((unitId) =>
        this.prisma.feePlanClassMap.create({ data: { feePlanId: planId, academicUnitId: unitId }, include: { academicUnit: { select: { id: true, name: true, displayName: true } } } }),
      ),
    );
    return maps;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Concessions
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudentConcessions(institutionId: string, studentId: string) {
    return this.prisma.feeConcession.findMany({
      where: { institutionId, studentId },
      include: { feePlanItem: { include: { feeCategory: true, feePlan: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addConcession(institutionId: string, dto: AddConcessionDto, approvedByUserId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, institutionId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student not found');
    const item = await this.prisma.feePlanItem.findFirst({ where: { id: dto.feePlanItemId, feePlan: { institutionId } } });
    if (!item) throw new NotFoundException('Plan item not found');
    if (dto.amount > item.totalAmount) throw new BadRequestException('Concession amount cannot exceed the item total amount');
    return this.prisma.feeConcession.create({
      data: { institutionId, studentId: dto.studentId, feePlanItemId: dto.feePlanItemId, amount: dto.amount, reason: dto.reason, approvedByUserId },
      include: { feePlanItem: { include: { feeCategory: true } } },
    });
  }

  async deleteConcession(institutionId: string, concessionId: string) {
    const c = await this.prisma.feeConcession.findFirst({ where: { id: concessionId, institutionId } });
    if (!c) throw new NotFoundException('Concession not found');
    return this.prisma.feeConcession.delete({ where: { id: concessionId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Student Fee Ledger (core new feature)
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudentLedger(institutionId: string, studentId: string, yearId?: string, parentUserId?: string) {
    if (parentUserId) {
      const owned = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!owned) throw new ForbiddenException('Not authorised to view this student\'s data');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true, academicUnit: { select: { id: true, name: true, displayName: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Resolve current year if not provided
    let resolvedYearId = yearId;
    if (!resolvedYearId) {
      const current = await this.prisma.academicYear.findFirst({ where: { institutionId, isCurrent: true }, select: { id: true } });
      resolvedYearId = current?.id;
    }

    if (!resolvedYearId || !student.academicUnitId) {
      return { student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo, className: student.academicUnit?.displayName || student.academicUnit?.name || '—' }, plan: null, items: [], totalAnnual: 0, totalConcession: 0, totalNet: 0, totalPaid: 0, totalBalance: 0 };
    }

    // Find the fee plan assigned to this student's class
    const classMap = await this.prisma.feePlanClassMap.findFirst({
      where: { academicUnitId: student.academicUnitId, feePlan: { institutionId, academicYearId: resolvedYearId, isActive: true, deletedAt: null } },
      include: {
        feePlan: {
          include: {
            items: {
              include: {
                feeCategory: true,
                installments: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
              },
            },
          },
        },
      },
    });

    if (!classMap) {
      return { student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo, className: student.academicUnit?.displayName || student.academicUnit?.name || '—' }, plan: null, items: [], totalAnnual: 0, totalConcession: 0, totalNet: 0, totalPaid: 0, totalBalance: 0 };
    }

    const plan = classMap.feePlan;
    const planItemIds = plan.items.map((i) => i.id);
    const installmentIds = plan.items.flatMap((i) => i.installments.map((inst) => inst.id));

    const [concessions, collections] = await Promise.all([
      this.prisma.feeConcession.findMany({ where: { studentId, feePlanItemId: { in: planItemIds } } }),
      this.prisma.feeCollection.findMany({ where: { studentId, institutionId, feePlanInstallmentId: { in: installmentIds } }, select: { feePlanInstallmentId: true, amount: true } }),
    ]);

    const concessionByItem = new Map<string, number>();
    for (const c of concessions) concessionByItem.set(c.feePlanItemId, (concessionByItem.get(c.feePlanItemId) ?? 0) + c.amount);

    const paidByInstallment = new Map<string, number>();
    for (const c of collections) {
      if (c.feePlanInstallmentId) paidByInstallment.set(c.feePlanInstallmentId, (paidByInstallment.get(c.feePlanInstallmentId) ?? 0) + c.amount);
    }

    const today = new Date();

    const items = plan.items.map((item) => {
      const totalConcession = concessionByItem.get(item.id) ?? 0;
      const netAmount = Math.max(0, item.totalAmount - totalConcession);
      const numInst = item.installments.length || 1;
      const concessionPerInst = totalConcession / numInst;

      const installments = item.installments.map((inst) => {
        const netInstAmount = Math.max(0, inst.amount - concessionPerInst);
        const paid = paidByInstallment.get(inst.id) ?? 0;
        const balance = Math.max(0, netInstAmount - paid);
        const isOverdue = inst.dueDate ? inst.dueDate < today && balance > 0 : false;
        const status = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : isOverdue ? 'overdue' : 'due';
        return { id: inst.id, label: inst.label, amount: inst.amount, dueDate: inst.dueDate, concession: concessionPerInst, netAmount: netInstAmount, paid, balance, status, isOverdue, sortOrder: inst.sortOrder };
      });

      const itemPaid = installments.reduce((s, i) => s + i.paid, 0);
      const itemBalance = installments.reduce((s, i) => s + i.balance, 0);
      return { feePlanItemId: item.id, feeCategoryId: item.feeCategoryId, categoryName: item.feeCategory.name, categoryType: item.feeCategory.type, totalAmount: item.totalAmount, concession: totalConcession, netAmount, installments, totalPaid: itemPaid, totalBalance: itemBalance };
    });

    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNo: student.admissionNo, className: student.academicUnit?.displayName || student.academicUnit?.name || '—' },
      plan: { id: plan.id, name: plan.name, description: plan.description },
      items,
      totalAnnual: items.reduce((s, i) => s + i.totalAmount, 0),
      totalConcession: items.reduce((s, i) => s + i.concession, 0),
      totalNet: items.reduce((s, i) => s + i.netAmount, 0),
      totalPaid: items.reduce((s, i) => s + i.totalPaid, 0),
      totalBalance: items.reduce((s, i) => s + i.totalBalance, 0),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 — Collections
  // ═══════════════════════════════════════════════════════════════════════════

  async recordCollections(institutionId: string, dto: RecordCollectionDto, collectedByUserId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, institutionId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, admissionNo: true } });
    if (!student) throw new NotFoundException('Student not found');
    if (!dto.items.length) throw new BadRequestException('No items provided');
    const currentYear = await this.prisma.academicYear.findFirst({ where: { institutionId, isCurrent: true }, select: { id: true } });

    return this.prisma.$transaction(async (tx) => {
      const baseCount = await tx.feeCollection.count({ where: { institutionId } });
      const rcpYear = new Date().getFullYear();
      const results: Awaited<ReturnType<typeof tx.feeCollection.create>>[] = [];
      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const receiptNo = `FRC-${rcpYear}-${String(baseCount + i + 1).padStart(5, '0')}`;
        const coll = await tx.feeCollection.create({
          data: { institutionId, studentId: dto.studentId, feePlanItemId: item.feePlanItemId, feePlanInstallmentId: item.feePlanInstallmentId, feeCategoryId: item.feeCategoryId, academicYearId: dto.academicYearId ?? currentYear?.id, amount: item.amount, paymentMode: dto.paymentMode, receiptNo, paidOn: new Date(dto.paidOn), remarks: dto.remarks, collectedByUserId },
          include: { feeCategory: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        });
        results.push(coll);
      }
      return { collections: results, totalCollected: dto.items.reduce((s, i) => s + i.amount, 0), student };
    }, { timeout: 15000, maxWait: 10000 });
  }

  async getStudentCollections(institutionId: string, studentId: string, parentUserId?: string) {
    if (parentUserId) {
      const owned = await this.prisma.student.findFirst({ where: { id: studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!owned) throw new ForbiddenException('Not authorised to view this student\'s data');
    }
    const [legacyPayments, v2Collections] = await Promise.all([
      this.prisma.feePayment.findMany({ where: { institutionId, studentId }, include: { feeHead: true }, orderBy: { paidOn: 'desc' } }),
      this.prisma.feeCollection.findMany({ where: { institutionId, studentId }, include: { feeCategory: true, feePlanInstallment: true }, orderBy: { paidOn: 'desc' } }),
    ]);
    const legacyMapped = legacyPayments.map((p) => ({ id: p.id, receiptNo: p.receiptNo, amount: p.amount, paymentMode: p.paymentMode, paidOn: p.paidOn, categoryName: p.feeHead.name, installmentLabel: p.installmentName, remarks: p.remarks, source: 'legacy' as const, createdAt: p.createdAt }));
    const v2Mapped = v2Collections.map((c) => ({ id: c.id, receiptNo: c.receiptNo, amount: c.amount, paymentMode: c.paymentMode, paidOn: c.paidOn, categoryName: c.feeCategory.name, installmentLabel: c.feePlanInstallment?.label ?? null, remarks: c.remarks, source: 'v2' as const, createdAt: c.createdAt }));
    const all = [...legacyMapped, ...v2Mapped].sort((a, b) => new Date(b.paidOn).getTime() - new Date(a.paidOn).getTime());
    return { payments: all, total: all.reduce((s, p) => s + p.amount, 0) };
  }

  async getCollectionById(institutionId: string, collectionId: string, parentUserId?: string) {
    const coll = await this.prisma.feeCollection.findFirst({
      where: { id: collectionId, institutionId },
      include: { feeCategory: true, feePlanInstallment: true, student: { select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnit: { select: { displayName: true, name: true } } } } },
    });
    if (!coll) throw new NotFoundException('Collection not found');
    if (parentUserId) {
      const linked = await this.prisma.student.findFirst({ where: { id: coll.studentId, institutionId, parentUserId, deletedAt: null }, select: { id: true } });
      if (!linked) throw new ForbiddenException('Not authorised to view this collection');
    }
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId }, select: { name: true, board: true, address: true, phone: true, email: true, logoUrl: true, principalName: true, tagline: true, affiliationNo: true } });
    return { ...coll, institution };
  }

  async getV2DefaultersByPlan(institutionId: string, academicYearId: string, academicUnitId?: string) {
    const plans = await this.prisma.feePlan.findMany({
      where: { institutionId, academicYearId, isActive: true, deletedAt: null },
      include: { items: { include: { installments: true } }, classMaps: true },
    });
    if (plans.length === 0) return [];

    // Collect all installment IDs and unit → plan mapping
    const unitToPlan = new Map<string, typeof plans[0]>();
    for (const plan of plans) {
      for (const cm of plan.classMaps) unitToPlan.set(cm.academicUnitId, plan);
    }

    const students = await this.prisma.student.findMany({
      where: { institutionId, deletedAt: null, status: 'active', ...(academicUnitId ? { academicUnitId } : { academicUnitId: { in: [...unitToPlan.keys()] } }) },
      select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true, academicUnit: { select: { name: true, displayName: true } } },
    });
    if (students.length === 0) return [];

    const allInstallmentIds = plans.flatMap((p) => p.items.flatMap((i) => i.installments.map((inst) => inst.id)));
    const [concessions, collections] = await Promise.all([
      this.prisma.feeConcession.findMany({ where: { institutionId, studentId: { in: students.map((s) => s.id) } } }),
      this.prisma.feeCollection.groupBy({ by: ['studentId', 'feePlanInstallmentId'], where: { institutionId, feePlanInstallmentId: { in: allInstallmentIds } }, _sum: { amount: true } }),
    ]);

    const concessionMap = new Map<string, number>(); // studentId:itemId → amount
    for (const c of concessions) concessionMap.set(`${c.studentId}:${c.feePlanItemId}`, (concessionMap.get(`${c.studentId}:${c.feePlanItemId}`) ?? 0) + c.amount);

    const collectionMap = new Map<string, number>(); // studentId:installmentId → amount
    for (const c of collections) collectionMap.set(`${c.studentId}:${c.feePlanInstallmentId}`, (c._sum.amount ?? 0));

    const defaulters: { id: string; firstName: string; lastName: string; admissionNo: string; className: string; due: number; paid: number; balance: number }[] = [];
    for (const student of students) {
      const plan = unitToPlan.get(student.academicUnitId ?? '');
      if (!plan) continue;
      let totalDue = 0, totalPaid = 0;
      for (const item of plan.items) {
        const concession = concessionMap.get(`${student.id}:${item.id}`) ?? 0;
        const netItem = Math.max(0, item.totalAmount - concession);
        const numInst = item.installments.length || 1;
        const concPerInst = concession / numInst;
        for (const inst of item.installments) {
          const netInst = Math.max(0, inst.amount - concPerInst);
          const paid = collectionMap.get(`${student.id}:${inst.id}`) ?? 0;
          totalDue += netInst;
          totalPaid += Math.min(paid, netInst);
        }
      }
      const balance = totalDue - totalPaid;
      if (balance > 0) defaulters.push({ id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNo: student.admissionNo, className: student.academicUnit?.displayName || student.academicUnit?.name || '—', due: totalDue, paid: totalPaid, balance });
    }
    return defaulters.sort((a, b) => b.balance - a.balance);
  }
}
