import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
      where: { institutionId, academicUnitId, academicYearId },
      include: { feeHead: true },
      orderBy: { feeHead: { name: 'asc' } },
    });
  }

  async upsertFeeStructure(institutionId: string, dto: CreateFeeStructureDto) {
    const installmentName = dto.installmentName ?? null;
    const existing = await this.prisma.feeStructure.findFirst({
      where: { institutionId, academicUnitId: dto.academicUnitId, academicYearId: dto.academicYearId, feeHeadId: dto.feeHeadId, installmentName },
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

  async deleteFeeStructure(id: string) {
    return this.prisma.feeStructure.delete({ where: { id } });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  private async generateReceiptNo(institutionId: string): Promise<string> {
    const count = await this.prisma.feePayment.count({ where: { institutionId } });
    const year = new Date().getFullYear();
    return `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async recordPayment(institutionId: string, dto: RecordPaymentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const feeHead = await this.prisma.feeHead.findFirst({
      where: { id: dto.feeHeadId, institutionId, deletedAt: null },
    });
    if (!feeHead) throw new NotFoundException('Fee head not found');

    const receiptNo = await this.generateReceiptNo(institutionId);

    return this.prisma.feePayment.create({
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
  }

  async getStudentPayments(institutionId: string, studentId: string) {
    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, studentId },
      include: { feeHead: true },
      orderBy: { paidOn: 'desc' },
    });

    const total = payments.reduce((sum, p) => sum + p.amount, 0);
    return { payments, total };
  }

  async getStudentBalance(institutionId: string, studentId: string, academicYearId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { academicUnitId: true },
    });
    if (!student || !student.academicUnitId) return { due: 0, paid: 0, balance: 0, structures: [] };

    const structures = await this.prisma.feeStructure.findMany({
      where: { institutionId, academicUnitId: student.academicUnitId, academicYearId },
      include: { feeHead: true },
    });

    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, studentId, academicYearId },
    });

    const due = structures.reduce((sum, s) => sum + s.amount, 0);
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);

    return { due, paid, balance: due - paid, structures, payments };
  }

  async getDailyCollection(institutionId: string, date: string) {
    const payments = await this.prisma.feePayment.findMany({
      where: { institutionId, paidOn: new Date(date) },
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
    const structures = await this.prisma.feeStructure.findMany({
      where: { institutionId, academicYearId, ...(academicUnitId ? { academicUnitId } : {}) },
      include: { feeHead: true, academicUnit: true },
    });

    const studentWhere: any = { institutionId, deletedAt: null, status: 'active' };
    if (academicUnitId) studentWhere.academicUnitId = academicUnitId;

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: { id: true, firstName: true, lastName: true, admissionNo: true, academicUnitId: true },
    });

    const results = await Promise.all(
      students.map(async (s) => {
        const myStructures = structures.filter((st) => st.academicUnitId === s.academicUnitId);
        const due = myStructures.reduce((sum, st) => sum + st.amount, 0);
        if (due === 0) return null;

        const paid = await this.prisma.feePayment.aggregate({
          where: { institutionId, studentId: s.id, academicYearId },
          _sum: { amount: true },
        });

        const paidAmount = paid._sum.amount ?? 0;
        const balance = due - paidAmount;
        if (balance <= 0) return null;

        return { ...s, due, paid: paidAmount, balance };
      }),
    );

    return results.filter(Boolean);
  }
}
