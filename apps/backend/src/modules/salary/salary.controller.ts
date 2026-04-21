import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import {
  CreateSalaryStructureDto, UpdateSalaryStructureDto,
  AssignSalaryProfileDto, UpdateSalaryProfileDto,
  GenerateSalaryDto, UpdateSalaryStatusDto,
} from './dto/salary.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('salary')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  // ── Salary Structures ──────────────────────────────────────────────────────

  @Get('structures')
  @Permissions('salary.read')
  getStructures(@Request() req: any) {
    return this.salaryService.getStructures(req.tenant.institutionId);
  }

  @Post('structures')
  @Permissions('salary.write')
  createStructure(@Request() req: any, @Body() dto: CreateSalaryStructureDto) {
    return this.salaryService.createStructure(req.tenant.institutionId, dto);
  }

  @Patch('structures/:id')
  @Permissions('salary.write')
  updateStructure(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSalaryStructureDto) {
    return this.salaryService.updateStructure(req.tenant.institutionId, id, dto);
  }

  @Delete('structures/:id')
  @Permissions('salary.write')
  deleteStructure(@Request() req: any, @Param('id') id: string) {
    return this.salaryService.deleteStructure(req.tenant.institutionId, id);
  }

  // ── Staff Salary Profiles ──────────────────────────────────────────────────

  @Get('profiles')
  @Permissions('salary.read')
  getProfiles(@Request() req: any) {
    return this.salaryService.getProfiles(req.tenant.institutionId);
  }

  @Get('profiles/unassigned')
  @Permissions('salary.read')
  getStaffWithoutProfile(@Request() req: any) {
    return this.salaryService.getStaffWithoutProfile(req.tenant.institutionId);
  }

  @Get('profiles/user/:userId')
  @Permissions('salary.read')
  getProfile(@Request() req: any, @Param('userId') userId: string) {
    return this.salaryService.getProfile(req.tenant.institutionId, userId);
  }

  @Post('profiles')
  @Permissions('salary.write')
  assignProfile(@Request() req: any, @Body() dto: AssignSalaryProfileDto) {
    return this.salaryService.assignProfile(req.tenant.institutionId, req.user.userId, dto);
  }

  @Patch('profiles/:profileId')
  @Permissions('salary.write')
  updateProfile(@Request() req: any, @Param('profileId') profileId: string, @Body() dto: UpdateSalaryProfileDto) {
    return this.salaryService.updateProfile(req.tenant.institutionId, profileId, dto);
  }

  // ── Salary Generation ──────────────────────────────────────────────────────

  @Post('generate')
  @Permissions('salary.write')
  generateMonthly(@Request() req: any, @Body() dto: GenerateSalaryDto) {
    return this.salaryService.generateMonthly(req.tenant.institutionId, req.user.userId, dto);
  }

  // ── Salary Records ─────────────────────────────────────────────────────────

  @Get('records')
  @Permissions('salary.read')
  getRecords(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('status') status: string,
  ) {
    return this.salaryService.getRecords(
      req.tenant.institutionId,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
      status || undefined,
    );
  }

  @Get('records/:id')
  @Permissions('salary.read')
  getRecord(@Request() req: any, @Param('id') id: string) {
    return this.salaryService.getRecord(req.tenant.institutionId, id);
  }

  @Patch('records/:id/status')
  @Permissions('salary.write')
  updateRecordStatus(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSalaryStatusDto) {
    return this.salaryService.updateRecordStatus(req.tenant.institutionId, id, req.user.userId, dto);
  }

  // ── Staff Salary History ───────────────────────────────────────────────────

  @Get('staff/:userId/history')
  @Permissions('salary.read')
  getStaffHistory(@Request() req: any, @Param('userId') userId: string) {
    return this.salaryService.getStaffHistory(req.tenant.institutionId, userId);
  }

  // ── Monthly Summary ────────────────────────────────────────────────────────

  @Get('summary')
  @Permissions('salary.read')
  getMonthlySummary(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const now = new Date();
    return this.salaryService.getMonthlySummary(
      req.tenant.institutionId,
      month ? parseInt(month, 10) : now.getMonth() + 1,
      year ? parseInt(year, 10) : now.getFullYear(),
    );
  }
}
