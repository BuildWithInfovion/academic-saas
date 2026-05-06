import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// Retention policy:
//   AttendanceSession + AttendanceRecord  → delete if session date < (today − 1 year)
//   AuditLog                              → delete if createdAt  < (today − 6 months)
//
// Why these periods:
//   - Attendance: TC generation snapshots attendance % at issuance time, so historical
//     raw records are not needed beyond the current academic year + a buffer.
//   - AuditLog: Compliance/dispute window in Indian schools is typically one term.
//     Six months covers the full current + previous term safely.
//
// Runs on the 1st of every month at 02:00 AM (low-traffic window).
// Set CLEANUP_DRY_RUN=true to log counts without deleting (safe for testing).

const ATTENDANCE_RETAIN_MONTHS = 12;
const AUDIT_LOG_RETAIN_MONTHS = 6;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 2 1 * *') // 02:00 on the 1st of every month
  async runMonthlyCleanup() {
    const dryRun = process.env.CLEANUP_DRY_RUN === 'true';
    this.logger.log(`[Cleanup] Starting monthly retention job (dry_run=${dryRun})`);

    await this.pruneAttendance(dryRun);
    await this.pruneAuditLogs(dryRun);

    this.logger.log('[Cleanup] Monthly retention job complete');
  }

  private async pruneAttendance(dryRun: boolean) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - ATTENDANCE_RETAIN_MONTHS);

    // Find sessions older than cutoff first (we need their IDs for record deletion).
    // NOTE: This query is platform-wide (no institutionId filter) — all institutions
    // share the same 12-month retention period.  If per-institution retention policies
    // are ever required, add an institutionId + retentionMonths lookup here.
    const oldSessions = await this.prisma.attendanceSession.findMany({
      where: { date: { lt: cutoff } },
      select: { id: true },
    });

    if (oldSessions.length === 0) {
      this.logger.log('[Cleanup] Attendance: nothing to prune');
      return;
    }

    const sessionIds = oldSessions.map((s) => s.id);

    const recordCount = await this.prisma.attendanceRecord.count({
      where: { sessionId: { in: sessionIds } },
    });

    this.logger.log(
      `[Cleanup] Attendance: ${oldSessions.length} sessions / ${recordCount} records older than ${cutoff.toISOString().slice(0, 10)}`,
    );

    if (!dryRun) {
      // Delete records first (FK constraint), then sessions
      const deletedRecords = await this.prisma.attendanceRecord.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      const deletedSessions = await this.prisma.attendanceSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
      this.logger.log(
        `[Cleanup] Attendance: deleted ${deletedRecords.count} records, ${deletedSessions.count} sessions`,
      );
    }
  }

  private async pruneAuditLogs(dryRun: boolean) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - AUDIT_LOG_RETAIN_MONTHS);

    const count = await this.prisma.auditLog.count({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(
      `[Cleanup] AuditLog: ${count} entries older than ${cutoff.toISOString().slice(0, 10)}`,
    );

    if (!dryRun && count > 0) {
      const deleted = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(`[Cleanup] AuditLog: deleted ${deleted.count} entries`);
    }
  }
}
