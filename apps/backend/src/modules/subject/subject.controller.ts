import {
  Controller, Get, Post, Delete, Body, Param,
  UseGuards, Request,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, AssignSubjectDto } from './dto/subject.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('subjects')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  // GET — all staff can read subjects
  @Get()
  @Permissions('subjects.read')
  findAll(@Request() req: any) {
    return this.subjectService.findAll(req.tenant?.institutionId);
  }

  // POST — operator/director only
  @Post()
  @Permissions('subjects.write')
  create(@Request() req: any, @Body() dto: CreateSubjectDto) {
    return this.subjectService.create(req.tenant?.institutionId, dto);
  }

  // DELETE — operator/director only
  @Delete(':id')
  @Permissions('subjects.write')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.subjectService.remove(req.tenant?.institutionId, id);
  }

  // Unit-subject assignments
  @Get('units/:unitId')
  @Permissions('subjects.read')
  getUnitSubjects(@Request() req: any, @Param('unitId') unitId: string) {
    return this.subjectService.getUnitSubjects(req.tenant?.institutionId, unitId);
  }

  @Post('units/:unitId')
  @Permissions('subjects.write')
  assign(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.subjectService.assignSubjectToUnit(req.tenant?.institutionId, unitId, dto);
  }

  @Delete('units/:unitId/:subjectId')
  @Permissions('subjects.write')
  unassign(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.subjectService.removeSubjectFromUnit(req.tenant?.institutionId, unitId, subjectId);
  }
}
