import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StaffAttendanceService } from './staff-attendance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('staff-attendance')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class StaffAttendanceController {
  constructor(private readonly svc: StaffAttendanceService) {}

  // ── Self-marking (any staff) ───────────────────────────────────────────────

  @Post('mark-own')
  markOwn(
    @Req() req: AuthenticatedRequest,
    @Body() body: { status: 'present' | 'late' | 'half_day'; note?: string },
  ) {
    return this.svc.markOwn(
      req.tenant.institutionId,
      req.user.userId,
      body.status,
      body.note,
    );
  }

  @Post('clock-out')
  clockOut(@Req() req: AuthenticatedRequest) {
    return this.svc.clockOut(req.tenant.institutionId, req.user.userId);
  }

  @Get('my')
  getMyAttendance(
    @Req() req: AuthenticatedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.svc.getOwnMonthly(
      req.tenant.institutionId,
      req.user.userId,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
  }

  // ── Leave requests (any staff) ─────────────────────────────────────────────

  @Post('leave')
  createLeave(
    @Req() req: AuthenticatedRequest,
    @Body() body: { startDate: string; endDate: string; reason: string },
  ) {
    return this.svc.createLeaveRequest(
      req.tenant.institutionId,
      req.user.userId,
      body.startDate,
      body.endDate,
      body.reason,
    );
  }

  @Get('leave/my')
  getMyLeave(@Req() req: AuthenticatedRequest) {
    return this.svc.getMyLeaveRequests(
      req.tenant.institutionId,
      req.user.userId,
    );
  }

  // ── Admin / Operator / Principal / Director views ─────────────────────────

  @Get('daily')
  @Permissions('users.read')
  getDailyReport(@Req() req: AuthenticatedRequest, @Query('date') date: string) {
    return this.svc.getDailyReport(
      req.tenant.institutionId,
      date || new Date().toISOString().split('T')[0],
    );
  }

  @Get('monthly')
  @Permissions('users.read')
  getMonthlyReport(
    @Req() req: AuthenticatedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.svc.getMonthlyReport(
      req.tenant.institutionId,
      parseInt(year) || new Date().getFullYear(),
      parseInt(month) || new Date().getMonth() + 1,
    );
  }

  @Post('admin-mark')
  @Permissions('users.write')
  adminMark(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { userId: string; date: string; status: string; note?: string },
  ) {
    return this.svc.adminMark(
      req.tenant.institutionId,
      body.userId,
      body.date,
      body.status,
      req.user.userId,
      body.note,
    );
  }

  @Get('leave')
  @Permissions('users.read')
  getAllLeave(
    @Req() req: AuthenticatedRequest,
    @Query('status') status: string,
  ) {
    return this.svc.getAllLeaveRequests(
      req.tenant.institutionId,
      status || undefined,
    );
  }

  @Patch('leave/:id/review')
  @Permissions('users.write')
  reviewLeave(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { action: 'approved' | 'rejected'; reviewNote?: string },
  ) {
    return this.svc.reviewLeaveRequest(
      req.tenant.institutionId,
      id,
      body.action,
      req.user.userId,
      body.reviewNote,
    );
  }
}
