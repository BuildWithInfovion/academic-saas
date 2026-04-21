import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { CoverService, MarkAbsentDto, AssignSubstituteDto } from './cover.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('covers')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class CoverController {
  constructor(private readonly coverService: CoverService) {}

  // POST /covers/mark-absent — operator/director/principal marks teacher absent
  @Post('mark-absent')
  @Permissions('subjects.write')
  markAbsent(@Request() req: any, @Body() dto: MarkAbsentDto) {
    return this.coverService.markTeacherAbsent(req.tenant?.institutionId, dto);
  }

  // GET /covers/date/:date — get all covers for a specific date
  @Get('date/:date')
  @Permissions('subjects.read')
  getForDate(@Request() req: any, @Param('date') date: string) {
    return this.coverService.getCoversForDate(req.tenant?.institutionId, date);
  }

  // GET /covers/available-teachers?date=&dayOfWeek=&periodNo= — free teachers for a period
  @Get('available-teachers')
  @Permissions('subjects.write')
  getAvailableTeachers(
    @Request() req: any,
    @Query('date') date: string,
    @Query('dayOfWeek') dayOfWeek: string,
    @Query('periodNo') periodNo: string,
  ) {
    return this.coverService.getAvailableTeachers(
      req.tenant?.institutionId, date, Number(dayOfWeek), Number(periodNo),
    );
  }

  // PATCH /covers/:id/assign — assign substitute to a cover record
  @Patch(':id/assign')
  @Permissions('subjects.write')
  assign(@Request() req: any, @Param('id') id: string, @Body() dto: AssignSubstituteDto) {
    return this.coverService.assignSubstitute(req.tenant?.institutionId, id, dto);
  }

  // PATCH /covers/:id/unassign — remove substitute from a cover record
  @Patch(':id/unassign')
  @Permissions('subjects.write')
  unassign(@Request() req: any, @Param('id') id: string) {
    return this.coverService.unassignSubstitute(req.tenant?.institutionId, id);
  }

  // DELETE /covers/:id — cancel a cover (remove record entirely)
  @Delete(':id')
  @Permissions('subjects.write')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.coverService.cancelCover(req.tenant?.institutionId, id);
  }

  // GET /covers/my-duties?date= — teacher sees their own cover duties
  @Get('my-duties')
  @Permissions('subjects.read')
  myDuties(@Request() req: any, @Query('date') date: string) {
    const today = date || new Date().toISOString().split('T')[0];
    return this.coverService.getMyCoverDuties(req.tenant?.institutionId, req.user?.userId, today);
  }
}
