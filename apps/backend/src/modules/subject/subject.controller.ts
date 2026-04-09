import {
  Controller, Get, Post, Delete, Body, Param,
  UseGuards, Request,
} from '@nestjs/common';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, AssignSubjectDto } from './dto/subject.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('subjects')
@UseGuards(AuthGuard, TenantGuard)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.subjectService.findAll(req.tenant?.institutionId);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateSubjectDto) {
    return this.subjectService.create(req.tenant?.institutionId, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.subjectService.remove(req.tenant?.institutionId, id);
  }

  // Unit-subject assignments
  @Get('units/:unitId')
  getUnitSubjects(@Request() req: any, @Param('unitId') unitId: string) {
    return this.subjectService.getUnitSubjects(req.tenant?.institutionId, unitId);
  }

  @Post('units/:unitId')
  assign(
    @Request() req: any,
    @Param('unitId') unitId: string,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.subjectService.assignSubjectToUnit(req.tenant?.institutionId, unitId, dto);
  }

  @Delete('units/:unitId/:subjectId')
  unassign(@Param('unitId') unitId: string, @Param('subjectId') subjectId: string) {
    return this.subjectService.removeSubjectFromUnit(unitId, subjectId);
  }
}
