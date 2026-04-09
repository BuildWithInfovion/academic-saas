import {
  Controller, Get, Post, Delete, Patch, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ExamService } from './exam.service';
import { CreateExamDto, AddExamSubjectDto, SaveResultsDto } from './dto/exam.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('exams')
@UseGuards(AuthGuard, TenantGuard)
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Get()
  findAll(@Request() req: any, @Query('yearId') yearId: string) {
    return this.examService.findAll(req.tenant?.institutionId, yearId);
  }

  // Teacher: active exams with only their assigned subjects
  @Get('my-assigned')
  getMyAssigned(@Request() req: any) {
    return this.examService.getMyExamAssignments(req.tenant?.institutionId, req.user?.userId ?? '');
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateExamDto) {
    return this.examService.create(req.tenant?.institutionId, dto);
  }

  @Patch(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body('status') status: string) {
    return this.examService.updateStatus(req.tenant?.institutionId, id, status);
  }

  @Delete(':id')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.examService.delete(req.tenant?.institutionId, id);
  }

  // Exam subjects
  @Get(':id/subjects')
  getSubjects(@Param('id') id: string) {
    return this.examService.getExamSubjects(id);
  }

  @Post(':id/subjects')
  addSubject(@Param('id') id: string, @Body() dto: AddExamSubjectDto) {
    return this.examService.addExamSubject(id, dto);
  }

  @Delete(':id/subjects/:subjectEntryId')
  removeSubject(@Param('id') id: string, @Param('subjectEntryId') subjectEntryId: string) {
    return this.examService.removeExamSubject(id, subjectEntryId);
  }

  // Mark entry
  @Post('results')
  saveResults(@Request() req: any, @Body() dto: SaveResultsDto) {
    return this.examService.saveResults(req.tenant?.institutionId, dto);
  }

  @Get(':id/results')
  getResults(
    @Request() req: any,
    @Param('id') id: string,
    @Query('unitId') unitId: string,
  ) {
    return this.examService.getResults(req.tenant?.institutionId, id, unitId);
  }

  @Get(':id/completeness')
  getCompleteness(@Request() req: any, @Param('id') id: string) {
    return this.examService.getExamCompleteness(req.tenant?.institutionId, id);
  }

  @Get(':id/summary')
  getClassSummary(
    @Request() req: any,
    @Param('id') id: string,
    @Query('unitId') unitId: string,
  ) {
    return this.examService.getClassResultSummary(req.tenant?.institutionId, id, unitId);
  }

  @Get(':id/scorecard/:studentId')
  getScorecard(
    @Request() req: any,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.examService.getStudentScorecard(req.tenant?.institutionId, id, studentId);
  }
}
