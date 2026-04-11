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
} from '@nestjs/common';
import { StudentService } from './student.service';
import type { ConfirmAdmissionDto } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

interface TenantContext {
  institutionId: string;
  planCode: string;
  features: Record<string, any>;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  // ── PORTAL ENDPOINTS (before :id routes) ──────────────────────────────────

  @Get('me')
  getMyProfile(@Tenant() tenant: TenantContext, @Req() req: any) {
    const userId = req.user?.sub;
    return this.studentService.findByUserId(tenant.institutionId, userId);
  }

  @Get('child')
  getMyChild(@Tenant() tenant: TenantContext, @Req() req: any) {
    const userId = req.user?.sub;
    return this.studentService.findByParentUserId(tenant.institutionId, userId);
  }

  @Get('count')
  count(@Tenant() tenant: TenantContext) {
    return this.studentService.count(tenant.institutionId);
  }

  @Get('unlinked-parents')
  findUnlinkedParents(@Tenant() tenant: TenantContext, @Query('limit') limit?: string) {
    return this.studentService.findUnlinkedParents(tenant.institutionId, limit ? parseInt(limit) : 100);
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
  confirmAdmission(@Tenant() tenant: TenantContext, @Body() body: ConfirmAdmissionDto) {
    return this.studentService.confirmAdmission(tenant.institutionId, body);
  }

  @Post()
  create(@Tenant() tenant: TenantContext, @Body() body: CreateStudentDto) {
    return this.studentService.create(tenant.institutionId, body);
  }

  @Get()
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.studentService.findAll(tenant.institutionId, page, limit, search, unitId);
  }

  @Get(':id')
  findOne(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.studentService.findOne(tenant.institutionId, id);
  }

  @Patch(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() body: UpdateStudentDto,
  ) {
    return this.studentService.update(tenant.institutionId, id, body);
  }

  @Delete(':id')
  delete(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.studentService.delete(tenant.institutionId, id);
  }

  // ── PROMOTE ───────────────────────────────────────────────────────────────

  @Post('promote')
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
  unlinkUser(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query('role') role: 'student' | 'parent',
  ) {
    return this.studentService.unlinkUser(tenant.institutionId, id, role);
  }
}
