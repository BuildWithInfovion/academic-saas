import { Controller, Get, Put, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TimetableService, SaveSlotDto, GenerateTimetableDto } from './timetable.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('timetable')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  // GET /timetable/units/:unitId — any staff with subjects.read
  @Get('units/:unitId')
  @Permissions('subjects.read')
  getForUnit(@Request() req: any, @Param('unitId') unitId: string) {
    return this.timetableService.getForUnit(req.tenant?.institutionId, unitId);
  }

  // PUT /timetable/units/:unitId/slot — operator/director only
  @Put('units/:unitId/slot')
  @Permissions('subjects.write')
  saveSlot(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() dto: SaveSlotDto,
  ) {
    return this.timetableService.saveSlot(req.tenant?.institutionId, unitId, dto);
  }

  // POST /timetable/units/:unitId/generate — operator/director only
  @Post('units/:unitId/generate')
  @Permissions('subjects.write')
  generate(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() body: GenerateTimetableDto,
  ) {
    const periodsPerDay = body.periodsPerDay ?? 7;
    const workingDays = body.workingDays ?? [1, 2, 3, 4, 5];
    return this.timetableService.generate(req.tenant?.institutionId, unitId, periodsPerDay, workingDays);
  }

  // GET /timetable/my-schedule — teacher's own timetable
  @Get('my-schedule')
  @Permissions('subjects.read')
  getMySchedule(@Request() req: any) {
    return this.timetableService.getMySubjectSchedule(
      req.tenant?.institutionId,
      req.user?.userId ?? '',
    );
  }

  // GET /timetable/teacher/:teacherId — principal/operator views any teacher's schedule
  @Get('teacher/:teacherId')
  @Permissions('users.read')
  getTeacherSchedule(@Request() req: any, @Param('teacherId') teacherId: string) {
    return this.timetableService.getMySubjectSchedule(req.tenant?.institutionId, teacherId);
  }
}
