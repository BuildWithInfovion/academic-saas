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

@Controller('attendance')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // GET /attendance/notifications/parent — today's absent children for logged-in parent
  // Parent has 'attendance.read' — no extra guard needed
  @Get('notifications/parent')
  getParentNotifications(@Request() req: any) {
    return this.attendanceService.getParentAbsentNotifications(
      req.tenant?.institutionId ?? req.institutionId,
      req.user?.userId ?? '',
    );
  }

  // GET /attendance/units/:unitId/students — teacher/operator/principal use
  @Get('units/:unitId/students')
  @Permissions('attendance.read')
  getStudents(@Request() req: any, @Param('unitId') unitId: string) {
    return this.attendanceService.getStudentsForUnit(
      req.tenant?.institutionId ?? req.institutionId,
      unitId,
    );
  }

  // GET /attendance/units/:unitId/daily?date=2025-06-10
  @Get('units/:unitId/daily')
  @Permissions('attendance.read')
  getDailySheet(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getClassDailySummary(
      req.tenant?.institutionId ?? req.institutionId,
      unitId,
      date,
    );
  }

  // POST /attendance — save/update attendance (teacher + operator only)
  @Post()
  @Permissions('attendance.write')
  save(@Request() req: any, @Body() dto: SaveAttendanceDto) {
    return this.attendanceService.save(
      req.tenant?.institutionId ?? req.institutionId,
      req.user?.userId ?? req.user?.id ?? 'system',
      dto,
      req.user?.roles ?? [],
    );
  }

  // GET /attendance/students/:studentId/monthly
  @Get('students/:studentId/monthly')
  @Permissions('attendance.read')
  getStudentMonthly(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.attendanceService.getStudentMonthly(
      req.tenant?.institutionId ?? req.institutionId,
      studentId,
      parseInt(year),
      parseInt(month),
    );
  }

  // GET /attendance/units/:unitId/defaulters — operator/principal only
  @Get('units/:unitId/defaulters')
  @Permissions('attendance.read')
  getDefaulters(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('threshold') threshold: string,
  ) {
    return this.attendanceService.getDefaulters(
      req.tenant?.institutionId ?? req.institutionId,
      unitId,
      parseInt(year),
      parseInt(month),
      threshold ? parseInt(threshold) : 75,
    );
  }
}
