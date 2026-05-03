import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { StudentService } from './student.service';
import type { ConfirmAdmissionDto, ImportStudentRowDto } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StorageService } from '../../common/storage/storage.service';

interface TenantContext {
  institutionId: string;
  planCode: string;
  features: Record<string, any>;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('students')
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly storageService: StorageService,
  ) {}

  // ── PORTAL ENDPOINTS (before :id routes) ──────────────────────────────────

  @Get('my-profile')
  getMyProfile(@Tenant() tenant: TenantContext, @Req() req: any) {
    const userId = req.user?.userId;
    return this.studentService.findByStudentUserId(tenant.institutionId, userId);
  }

  @Get('child')
  getMyChild(@Tenant() tenant: TenantContext, @Req() req: any) {
    const userId = req.user?.userId;
    return this.studentService.findByParentUserId(tenant.institutionId, userId);
  }

  @Get('count')
  @Permissions('students.read')
  count(@Tenant() tenant: TenantContext, @Query('unitId') unitId?: string) {
    return this.studentService.count(tenant.institutionId, unitId);
  }

  @Get('exited')
  @Permissions('students.read')
  findExited(@Tenant() tenant: TenantContext) {
    return this.studentService.findExited(tenant.institutionId);
  }

  @Get('unlinked-parents')
  @Permissions('users.read')
  findUnlinkedParents(@Tenant() tenant: TenantContext, @Query('limit') limit?: string) {
    return this.studentService.findUnlinkedParents(tenant.institutionId, limit ? parseInt(limit) : 100);
  }

  // ── LEDGER IMPORT ─────────────────────────────────────────────────────────

  // GET /students/import-template — CSV template for legacy student migration
  @Get('import-template')
  @Permissions('users.write')
  getImportTemplate(@Res() res: Response) {
    const csv = [
      'First Name*,Last Name*,Middle Name,Gender (Male/Female/Other),Date of Birth (DD-MM-YYYY),Class*,Old Admission No,Admission Date (DD-MM-YYYY),Father Name,Mother Name,Parent Mobile,Address,Religion,Caste Category,Blood Group',
      'Ramesh,Sharma,Kumar,Male,15-06-2015,Class 5,OLD-001,01-06-2023,Rajesh Sharma,Sunita Sharma,9876543210,123 MG Road Mumbai,Hindu,General,A+',
      'Priya,Verma,,Female,20-08-2014,Class 6,,01-06-2022,Suresh Verma,Kavita Verma,9123456789,,,,',
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.csv"');
    return res.send(csv);
  }

  // POST /students/import — batch create students from ledger data (JSON rows from frontend CSV parse)
  @Post('import')
  @Permissions('users.write')
  importStudents(@Tenant() tenant: TenantContext, @Body() body: { rows: ImportStudentRowDto[] }) {
    return this.studentService.importStudents(tenant.institutionId, body.rows || []);
  }

  // ── ADMISSION ──────────────────────────────────────────────────────────────

  /**
   * POST /students/confirm-admission
   * Full admission confirmation:
   * - Creates student record
   * - Auto-creates parent user account with generated credentials
   * - Links parent to student
   * - Optionally records admission fee payment
   * Returns student + parent credentials (one-time display)
   */
  @Post('confirm-admission')
  @Permissions('users.write')
  confirmAdmission(@Tenant() tenant: TenantContext, @Body() body: ConfirmAdmissionDto) {
    return this.studentService.confirmAdmission(tenant.institutionId, body);
  }

  @Post()
  @Permissions('users.write')
  create(@Tenant() tenant: TenantContext, @Body() body: CreateStudentDto) {
    return this.studentService.create(tenant.institutionId, body);
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.studentService.findAll(tenant.institutionId, page, limit, search, unitId);
  }

  // GET /students/:id/photo-signature — Cloudinary signed upload for student photo
  @Get(':id/photo-signature')
  @Permissions('users.write')
  getPhotoSignature(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.storageService.generateUploadSignature(tenant.institutionId, id);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.studentService.findOne(tenant.institutionId, id);
  }

  @Patch(':id')
  @Permissions('users.write')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: UpdateStudentDto,
  ) {
    return this.studentService.update(tenant.institutionId, id, body);
  }

  @Delete(':id')
  @Permissions('users.write')
  delete(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.studentService.delete(tenant.institutionId, id);
  }

  // ── PROMOTE ───────────────────────────────────────────────────────────────

  @Post('promote')
  @Permissions('users.write')
  promote(
    @Tenant() tenant: TenantContext,
    @Req() req: any,
    @Body() body: { studentIds: string[]; targetUnitId?: string; sourceUnitId?: string; action: 'promote' | 'holdback' | 'transfer' },
  ) {
    return this.studentService.promote(
      tenant.institutionId,
      body.studentIds,
      body.targetUnitId ?? null,
      body.action,
      req.user?.userId,
      body.sourceUnitId,
    );
  }

  // ── PORTAL LINKING ────────────────────────────────────────────────────────

  @Post(':id/link-user')
  @Permissions('users.write')
  linkUser(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: { userId: string; role: 'student' | 'parent' },
  ) {
    return this.studentService.linkUser(
      tenant.institutionId,
      id,
      body.userId,
      body.role,
    );
  }

  @Delete(':id/link-user')
  @Permissions('users.write')
  unlinkUser(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query('role') role: 'student' | 'parent',
  ) {
    return this.studentService.unlinkUser(tenant.institutionId, id, role);
  }
}
