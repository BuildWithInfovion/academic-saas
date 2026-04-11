import { Controller, Get, Put, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TimetableService, SaveSlotDto, GenerateTimetableDto } from './timetable.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('timetable')
@UseGuards(AuthGuard, TenantGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  // GET /timetable/units/:unitId
  @Get('units/:unitId')
  getForUnit(@Request() req: any, @Param('unitId') unitId: string) {
    return this.timetableService.getForUnit(req.institutionId, unitId);
  }

  // PUT /timetable/units/:unitId/slot
  @Put('units/:unitId/slot')
  saveSlot(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() dto: SaveSlotDto,
  ) {
    return this.timetableService.saveSlot(req.institutionId, unitId, dto);
  }

  // POST /timetable/units/:unitId/generate
  @Post('units/:unitId/generate')
  generate(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() body: GenerateTimetableDto,
  ) {
    const periodsPerDay = body.periodsPerDay ?? 7;
    const workingDays = body.workingDays ?? [1, 2, 3, 4, 5];
    return this.timetableService.generate(req.institutionId, unitId, periodsPerDay, workingDays);
  }

  // GET /timetable/my-schedule — teacher's own timetable
  @Get('my-schedule')
  getMySchedule(@Request() req: any) {
    return this.timetableService.getMySubjectSchedule(req.institutionId, req.user?.userId ?? '');
  }

  // GET /timetable/teacher/:teacherId — principal views any teacher's schedule
  @Get('teacher/:teacherId')
  getTeacherSchedule(@Request() req: any, @Param('teacherId') teacherId: string) {
    return this.timetableService.getMySubjectSchedule(req.institutionId, teacherId);
  }
}
