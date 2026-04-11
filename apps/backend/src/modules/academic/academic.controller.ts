import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AcademicService, CreateAcademicYearDto } from './academic.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

interface CreateUnitDto {
  name: string;
  displayName?: string;
  level: number;
  parentId?: string;
  academicYearId?: string;
}

interface UpdateUnitDto {
  name?: string;
  displayName?: string;
}

interface SetClassTeacherDto {
  teacherUserId: string;
}

@Controller('academic')
@UseGuards(AuthGuard, TenantGuard)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  private resolveInstitutionId(req: any): string {
    return (
      req.tenant?.institutionId ||
      req.user?.institutionId ||
      req.headers['x-institution-id']
    );
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  @Get('units')
  getUnits(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    if (!institutionId) return [];
    return this.academicService.getUnits(institutionId);
  }

  @Get('units/leaf')
  getLeafUnits(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    if (!institutionId) return [];
    return this.academicService.getLeafUnits(institutionId);
  }

  /** GET /academic/units/classes — root-level classes only (no sections) */
  @Get('units/classes')
  getRootClasses(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    if (!institutionId) return [];
    return this.academicService.getRootClasses(institutionId);
  }

  @Get('units/:unitId')
  getUnitById(@Req() req: any, @Param('unitId') unitId: string) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.getUnitById(institutionId, unitId);
  }

  @Post('units')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  createUnit(@Req() req: any, @Body() dto: CreateUnitDto) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.createUnit(institutionId, dto);
  }

  @Patch('units/:unitId')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  updateUnit(
    @Req() req: any,
    @Param('unitId') unitId: string,
    @Body() dto: UpdateUnitDto,
  ) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.updateUnit(institutionId, unitId, dto);
  }

  @Delete('units/:unitId')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  deleteUnit(@Req() req: any, @Param('unitId') unitId: string) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.deleteUnit(institutionId, unitId);
  }

  // ── Class Teacher Assignment ───────────────────────────────────────────────

  /** GET /academic/class-teachers — all leaf units with class teacher (Operator / Principal) */
  @Get('class-teachers')
  getClassTeacherAssignments(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.getClassTeacherAssignments(institutionId);
  }

  /** GET /academic/my-class-units — units where logged-in teacher is class teacher */
  @Get('my-class-units')
  getMyClassUnits(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    const userId = String(req.user?.userId ?? '');
    return this.academicService.getMyClassUnits(institutionId, userId);
  }

  /** GET /academic/my-subject-units — unit+subject pairs where logged-in teacher teaches */
  @Get('my-subject-units')
  getMySubjectUnits(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    const userId = String(req.user?.userId ?? '');
    return this.academicService.getMySubjectUnits(institutionId, userId);
  }

  /** PATCH /academic/units/:unitId/class-teacher — assign class teacher */
  @Patch('units/:unitId/class-teacher')
  setClassTeacher(
    @Req() req: any,
    @Param('unitId') unitId: string,
    @Body() body: SetClassTeacherDto,
  ) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.setClassTeacher(
      institutionId,
      unitId,
      body.teacherUserId,
    );
  }

  /** DELETE /academic/units/:unitId/class-teacher — remove class teacher assignment */
  @Delete('units/:unitId/class-teacher')
  removeClassTeacher(@Req() req: any, @Param('unitId') unitId: string) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.removeClassTeacher(institutionId, unitId);
  }

  // ── Academic Years ─────────────────────────────────────────────────────────

  @Get('years')
  getYears(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    if (!institutionId) return [];
    return this.academicService.getYears(institutionId);
  }

  @Get('years/current')
  getCurrentYear(@Req() req: any) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.getCurrentYear(institutionId);
  }

  @Post('years')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  createYear(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.createYear(institutionId, dto);
  }

  @Patch('years/:id/set-current')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  setCurrentYear(@Req() req: any, @Param('id') id: string) {
    const institutionId = this.resolveInstitutionId(req);
    return this.academicService.setCurrentYear(institutionId, id);
  }
}
