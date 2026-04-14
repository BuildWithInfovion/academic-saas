import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { StaffAttendanceService } from './staff-attendance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('staff-attendance')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class StaffAttendanceController {
  constructor(private readonly svc: StaffAttendanceService) {}

  private institutionId(req: any): string {
    return req.tenant?.institutionId || req.user?.institutionId || req.headers['x-institution-id'];
  }

  private userId(req: any): string {
    return String(req.user?.userId ?? '');
  }

  // ── Self-marking (any staff) ───────────────────────────────────────────────

  /** POST /staff-attendance/mark-own — staff marks own attendance for today */
  @Post('mark-own')
  markOwn(
    @Req() req: any,
    @Body() body: { status: 'present' | 'late' | 'half_day'; note?: string },
  ) {
    return this.svc.markOwn(this.institutionId(req), this.userId(req), body.status, body.note);
  }

  /** POST /staff-attendance/clock-out — staff clocks out for today */
  @Post('clock-out')
  clockOut(@Req() req: any) {
    return this.svc.clockOut(this.institutionId(req), this.userId(req));
  }

  /** GET /staff-attendance/my?year=2026&month=4 — own monthly attendance */
  @Get('my')
  getMyAttendance(@Req() req: any, @Query('year') year: string, @Query('month') month: string) {
    return this.svc.getOwnMonthly(
      this.institutionId(req), this.userId(req),
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
  }

  // ── Leave requests (any staff) ─────────────────────────────────────────────

  /** POST /staff-attendance/leave — submit a leave request */
  @Post('leave')
  createLeave(
    @Req() req: any,
    @Body() body: { startDate: string; endDate: string; reason: string },
  ) {
    return this.svc.createLeaveRequest(
      this.institutionId(req), this.userId(req),
      body.startDate, body.endDate, body.reason,
    );
  }

  /** GET /staff-attendance/leave/my — own leave requests */
  @Get('leave/my')
  getMyLeave(@Req() req: any) {
    return this.svc.getMyLeaveRequests(this.institutionId(req), this.userId(req));
  }

  // ── Admin / Operator / Principal / Director views ─────────────────────────

  /** GET /staff-attendance/daily?date=2026-04-11 — all staff for a date (admin/principal) */
  @Get('daily')
  @Permissions('users.read')
  getDailyReport(@Req() req: any, @Query('date') date: string) {
    return this.svc.getDailyReport(this.institutionId(req), date || new Date().toISOString().split('T')[0]);
  }

  /** GET /staff-attendance/monthly?year=2026&month=4 — monthly summary (admin/principal) */
  @Get('monthly')
  @Permissions('users.read')
  getMonthlyReport(@Req() req: any, @Query('year') year: string, @Query('month') month: string) {
    return this.svc.getMonthlyReport(
      this.institutionId(req),
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
  }

  /** POST /staff-attendance/admin-mark — operator overrides attendance for any staff */
  @Post('admin-mark')
  @Permissions('users.write')
  adminMark(
    @Req() req: any,
    @Body() body: { userId: string; date: string; status: string; note?: string },
  ) {
    return this.svc.adminMark(
      this.institutionId(req), body.userId, body.date, body.status,
      this.userId(req), body.note,
    );
  }

  /** GET /staff-attendance/leave?status=pending — all leave requests */
  @Get('leave')
  @Permissions('users.read')
  getAllLeave(@Req() req: any, @Query('status') status: string) {
    return this.svc.getAllLeaveRequests(this.institutionId(req), status || undefined);
  }

  /** PATCH /staff-attendance/leave/:id/review — principal approves/rejects */
  @Patch('leave/:id/review')
  @Permissions('users.write')
  reviewLeave(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { action: 'approved' | 'rejected'; reviewNote?: string },
  ) {
    return this.svc.reviewLeaveRequest(
      this.institutionId(req), id, body.action, this.userId(req), body.reviewNote,
    );
  }
}
