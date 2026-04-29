import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Self mark ──────────────────────────────────────────────────────────────

  /**
   * Staff member marks their own attendance for today (clock-in).
   */
  async markOwn(
    institutionId: string,
    userId: string,
    status: 'present' | 'late' | 'half_day',
    note?: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.staffAttendance.findUnique({
      where: { institutionId_userId_date: { institutionId, userId, date: today } },
    });
    if (existing) {
      throw new BadRequestException('Attendance already marked for today');
    }

    return this.prisma.staffAttendance.create({
      data: {
        institutionId,
        userId,
        date: today,
        status,
        clockIn: new Date(),
        note,
        markedById: userId,
      },
    });
  }

  /**
   * Staff member clocks out for today.
   */
  async clockOut(institutionId: string, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.staffAttendance.findUnique({
      where: { institutionId_userId_date: { institutionId, userId, date: today } },
    });
    if (!existing) {
      throw new BadRequestException('You have not clocked in yet today');
    }
    if ((existing as any).clockOut) {
      throw new BadRequestException('Already clocked out for today');
    }

    return this.prisma.staffAttendance.update({
      where: { id: existing.id },
      data: { clockOut: new Date() } as any,
    });
  }

  /** Get own attendance for a month */
  async getOwnMonthly(institutionId: string, userId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);
    return this.prisma.staffAttendance.findMany({
      where: { institutionId, userId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }

  // ── Admin / Operator override ──────────────────────────────────────────────

  /** Admin marks or overrides attendance for any staff member for any date */
  async adminMark(
    institutionId: string,
    targetUserId: string,
    date: string,
    status: string,
    markedById: string,
    note?: string,
  ) {
    // Validate target user belongs to this institution
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!targetUser) throw new NotFoundException('User not found in this institution');

    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    return this.prisma.staffAttendance.upsert({
      where: { institutionId_userId_date: { institutionId, userId: targetUserId, date: d } },
      create: { institutionId, userId: targetUserId, date: d, status, note, markedById },
      update: { status, note, markedById },
    });
  }

  /** Get attendance for all staff on a given date (Operator / Director view) */
  async getDailyReport(institutionId: string, date: string) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const records = await this.prisma.staffAttendance.findMany({
      where: { institutionId, date: d },
      include: { user: { select: { id: true, email: true, phone: true, roles: { include: { role: true } } } } },
    });

    return records;
  }

  /** Get monthly attendance summary for all staff */
  async getMonthlyReport(institutionId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.staffAttendance.findMany({
      where: { institutionId, date: { gte: from, lte: to } },
      include: { user: { select: { id: true, email: true, phone: true } } },
      orderBy: [{ userId: 'asc' }, { date: 'asc' }],
    });

    // Group by userId
    const byUser: Record<string, { user: { id: string; email: string | null; phone: string | null }; records: typeof records }> = {};
    for (const r of records) {
      if (!byUser[r.userId]) byUser[r.userId] = { user: r.user, records: [] };
      byUser[r.userId].records.push(r);
    }

    return Object.values(byUser).map(({ user, records: recs }) => ({
      user,
      present: recs.filter((r) => r.status === 'present').length,
      late: recs.filter((r) => r.status === 'late').length,
      halfDay: recs.filter((r) => r.status === 'half_day').length,
      absent: recs.filter((r) => r.status === 'absent').length,
      total: recs.length,
    }));
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  async createLeaveRequest(
    institutionId: string,
    userId: string,
    startDate: string,
    endDate: string,
    reason: string,
  ) {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(endDate);   end.setHours(0, 0, 0, 0);
    if (end < start) throw new BadRequestException('End date must be on or after start date');

    return this.prisma.staffLeaveRequest.create({
      data: { institutionId, userId, startDate: start, endDate: end, reason },
    });
  }

  async getMyLeaveRequests(institutionId: string, userId: string) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { institutionId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllLeaveRequests(institutionId: string, status?: string) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { institutionId, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewLeaveRequest(
    institutionId: string,
    requestId: string,
    action: 'approved' | 'rejected',
    approverId: string,
    reviewNote?: string,
  ) {
    const req = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: requestId, institutionId, status: 'pending' },
    });
    if (!req) throw new NotFoundException('Leave request not found or already reviewed');

    // Build the list of days to mark absent before opening the transaction
    const days: Date[] = [];
    if (action === 'approved') {
      const cur = new Date(req.startDate);
      const end = new Date(req.endDate);
      while (cur <= end) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Approve/reject + absence records atomically — no partial state on failure
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.staffLeaveRequest.update({
        where: { id: requestId },
        data: { status: action, approvedById: approverId, reviewNote },
      });

      for (const day of days) {
        await tx.staffAttendance.upsert({
          where: { institutionId_userId_date: { institutionId, userId: req.userId, date: day } },
          create: { institutionId, userId: req.userId, date: day, status: 'absent', note: `Leave: ${req.reason}`, markedById: approverId },
          update: { status: 'absent', note: `Leave: ${req.reason}` },
        });
      }

      return result;
    }, { timeout: 15000, maxWait: 10000 });

    return updated;
  }
}
