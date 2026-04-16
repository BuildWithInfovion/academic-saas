import {
  Controller, Get, Post, Delete, Patch, Body, Param, Query,
  UseGuards, Request, BadRequestException,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { CreateExamDto, AddExamSubjectDto, SaveResultsDto } from './dto/exam.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('exams')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  // GET — anyone with exams.read (all staff + student + parent)
  @Get()
  @Permissions('exams.read')
  findAll(@Request() req: any, @Query('yearId') yearId: string) {
    return this.examService.findAll(req.tenant?.institutionId, yearId);
  }

  // Teacher: active exams with only their assigned subjects
  @Get('my-assigned')
  @Permissions('exams.read')
  getMyAssigned(@Request() req: any) {
    return this.examService.getMyExamAssignments(req.tenant?.institutionId, req.user?.userId ?? '');
  }

  // POST — create exam: operator/director only (subjects.write is admin-only)
  @Post()
  @Permissions('subjects.write')
  create(@Request() req: any, @Body() dto: CreateExamDto) {
    return this.examService.create(req.tenant?.institutionId, dto);
  }

  // PATCH status — operator/director only
  @Patch(':id/status')
  @Permissions('subjects.write')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: string) {
    const allowed = ['draft', 'active', 'completed'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${allowed.join(', ')}`);
    }
    return this.examService.updateStatus(req.tenant?.institutionId, id, status);
  }

  // DELETE — operator/director only
  @Delete(':id')
  @Permissions('subjects.write')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.examService.delete(req.tenant?.institutionId, id);
  }

  // Exam subjects — read: all staff; write: operator/director only
  @Get(':id/subjects')
  @Permissions('exams.read')
  getSubjects(@Request() req: any, @Param('id') id: string) {
    return this.examService.getExamSubjects(req.tenant?.institutionId, id);
  }

  @Post(':id/subjects')
  @Permissions('subjects.write')
  addSubject(@Request() req: any, @Param('id') id: string, @Body() dto: AddExamSubjectDto) {
    return this.examService.addExamSubject(req.tenant?.institutionId, id, dto);
  }

  @Delete(':id/subjects/:subjectEntryId')
  @Permissions('subjects.write')
  removeSubject(@Request() req: any, @Param('id') id: string, @Param('subjectEntryId') subjectEntryId: string) {
    return this.examService.removeExamSubject(req.tenant?.institutionId, id, subjectEntryId);
  }

  // Mark entry — teacher + operator (exams.write)
  @Post('results')
  @Permissions('exams.write')
  saveResults(@Request() req: any, @Body() dto: SaveResultsDto) {
    return this.examService.saveResults(req.tenant?.institutionId, dto);
  }

  @Get(':id/results')
  @Permissions('exams.read')
  getResults(
    @Request() req: any,
    @Param('id') id: string,
    @Query('unitId') unitId: string,
  ) {
    return this.examService.getResults(req.tenant?.institutionId, id, unitId);
  }

  @Get(':id/completeness')
  @Permissions('exams.read')
  getCompleteness(@Request() req: any, @Param('id') id: string) {
    return this.examService.getExamCompleteness(req.tenant?.institutionId, id);
  }

  @Get(':id/summary')
  @Permissions('exams.read')
  getClassSummary(
    @Request() req: any,
    @Param('id') id: string,
    @Query('unitId') unitId: string,
  ) {
    return this.examService.getClassResultSummary(req.tenant?.institutionId, id, unitId);
  }

  @Get(':id/scorecard/:studentId')
  @Permissions('exams.read')
  getScorecard(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    // C-06: pass parentUserId so service enforces child ownership for parent role
    const parentUserId = req.user?.roles?.includes('parent')
      ? req.user.userId
      : undefined;
    return this.examService.getStudentScorecard(
      req.tenant?.institutionId,
      id,
      studentId,
      parentUserId,
    );
  }

  @Get(':id/admit-card/:studentId')
  @Permissions('exams.read')
  getAdmitCard(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    // C-06: pass parentUserId so service enforces child ownership for parent role
    const parentUserId = req.user?.roles?.includes('parent')
      ? req.user.userId
      : undefined;
    return this.examService.getAdmitCard(
      req.tenant?.institutionId,
      id,
      studentId,
      parentUserId,
    );
  }
}
