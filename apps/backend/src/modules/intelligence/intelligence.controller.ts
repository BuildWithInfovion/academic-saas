import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('intelligence')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Permissions('users.read')
export class IntelligenceController {
  constructor(private readonly svc: IntelligenceService) {}

  // Today: how many classes have marked attendance vs. total
  @Get('today-attendance')
  getTodayAttendanceProgress(@Req() req: AuthenticatedRequest) {
    return this.svc.getTodayAttendanceProgress(req.tenant.institutionId);
  }

  // Teacher efficiency: days since last mark, sessions this week, alert flags
  @Get('teacher-efficiency')
  getTeacherEfficiency(@Req() req: AuthenticatedRequest) {
    return this.svc.getTeacherEfficiency(req.tenant.institutionId);
  }

  // Pending actions: TC count, leave count, staff on leave today, exam alerts, late staff
  @Get('pending-actions')
  getPendingActions(@Req() req: AuthenticatedRequest) {
    return this.svc.getPendingActions(req.tenant.institutionId);
  }

  // Academic overview: class-wise avg % across completed exams for a year
  @Get('academic-overview')
  getAcademicOverview(
    @Req() req: AuthenticatedRequest,
    @Query('yearId') yearId: string,
  ) {
    return this.svc.getAcademicOverview(req.tenant.institutionId, yearId);
  }
}
