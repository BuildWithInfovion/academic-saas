import {
  Controller, Get, Post, Body, Query, Param,
  UseGuards, Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SaveAttendanceDto } from './dto/attendance.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('attendance')
@UseGuards(AuthGuard, TenantGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // GET /attendance/notifications/parent — today's absent children for logged-in parent
  @Get('notifications/parent')
  getParentNotifications(@Request() req: any) {
    return this.attendanceService.getParentAbsentNotifications(
      req.institutionId,
      req.user?.userId ?? '',
    );
  }

  // GET /attendance/units/:unitId/students — list students for attendance sheet
  @Get('units/:unitId/students')
  getStudents(@Request() req: any, @Param('unitId') unitId: string) {
    return this.attendanceService.getStudentsForUnit(req.institutionId, unitId);
  }

  // GET /attendance/units/:unitId/daily?date=2025-06-10 — get/init attendance for a day
  @Get('units/:unitId/daily')
  getDailySheet(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getClassDailySummary(req.institutionId, unitId, date);
  }

  // POST /attendance — save/update attendance
  @Post()
  save(@Request() req: any, @Body() dto: SaveAttendanceDto) {
    return this.attendanceService.save(req.institutionId, req.user?.id ?? 'system', dto);
  }

  // GET /attendance/students/:studentId/monthly?year=2025&month=6
  @Get('students/:studentId/monthly')
  getStudentMonthly(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.attendanceService.getStudentMonthly(
      req.institutionId,
      studentId,
      parseInt(year),
      parseInt(month),
    );
  }

  // GET /attendance/units/:unitId/defaulters?year=2025&month=6&threshold=75
  @Get('units/:unitId/defaulters')
  getDefaulters(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('threshold') threshold: string,
  ) {
    return this.attendanceService.getDefaulters(
      req.institutionId,
      unitId,
      parseInt(year),
      parseInt(month),
      threshold ? parseInt(threshold) : 75,
    );
  }
}
