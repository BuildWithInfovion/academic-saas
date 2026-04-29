import {
  Controller, Get, Post, Body, Query, Param,
  UseGuards, Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SaveAttendanceDto } from './dto/attendance.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('attendance')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // GET /attendance/notifications/parent — today's absent children for logged-in parent
  @Get('notifications/parent')
  getParentNotifications(@Request() req: AuthenticatedRequest) {
    return this.attendanceService.getParentAbsentNotifications(
      req.tenant.institutionId,
      req.user.userId,
    );
  }

  // GET /attendance/units/:unitId/students — teacher/operator/principal use
  @Get('units/:unitId/students')
  @Permissions('attendance.read')
  getStudents(@Request() req: AuthenticatedRequest, @Param('unitId') unitId: string) {
    return this.attendanceService.getStudentsForUnit(req.tenant.institutionId, unitId);
  }

  // GET /attendance/units/:unitId/daily?date=2025-06-10
  @Get('units/:unitId/daily')
  @Permissions('attendance.read')
  getDailySheet(
    @Request() req: AuthenticatedRequest,
    @Param('unitId') unitId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getClassDailySummary(req.tenant.institutionId, unitId, date);
  }

  // POST /attendance — save/update attendance (teacher + operator only)
  @Post()
  @Permissions('attendance.write')
  save(@Request() req: AuthenticatedRequest, @Body() dto: SaveAttendanceDto) {
    return this.attendanceService.save(
      req.tenant.institutionId,
      req.user.userId,
      dto,
      req.user.roles,
    );
  }

  // GET /attendance/students/:studentId/monthly
  @Get('students/:studentId/monthly')
  @Permissions('attendance.read')
  getStudentMonthly(
    @Request() req: AuthenticatedRequest,
    @Param('studentId') studentId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.attendanceService.getStudentMonthly(
      req.tenant.institutionId,
      studentId,
      parseInt(year) || now.getFullYear(),
      parseInt(month) || now.getMonth() + 1,
    );
  }

  // GET /attendance/units/:unitId/monthly-report — class-wise full month report
  @Get('units/:unitId/monthly-report')
  @Permissions('attendance.read')
  getMonthlyReport(
    @Request() req: AuthenticatedRequest,
    @Param('unitId') unitId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.attendanceService.getClassMonthlyReport(
      req.tenant.institutionId,
      unitId,
      parseInt(year) || now.getFullYear(),
      parseInt(month) || now.getMonth() + 1,
    );
  }

  // GET /attendance/class-summary?year=&month= — dashboard chart endpoint
  @Get('class-summary')
  @Permissions('attendance.read')
  getClassSummary(
    @Request() req: AuthenticatedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.attendanceService.getClassSummary(
      req.tenant.institutionId,
      parseInt(year) || now.getFullYear(),
      parseInt(month) || now.getMonth() + 1,
    );
  }

  // GET /attendance/units/:unitId/defaulters — operator/principal only
  @Get('units/:unitId/defaulters')
  @Permissions('attendance.read')
  getDefaulters(
    @Request() req: AuthenticatedRequest,
    @Param('unitId') unitId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('threshold') threshold: string,
  ) {
    const now = new Date();
    return this.attendanceService.getDefaulters(
      req.tenant.institutionId,
      unitId,
      parseInt(year) || now.getFullYear(),
      parseInt(month) || now.getMonth() + 1,
      parseInt(threshold) || 75,
    );
  }
}
