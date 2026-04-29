import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto, RecordBulkPaymentDto } from './dto/fees.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('fees')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ── Fee Heads ─────────────────────────────────────────────────────────────
  @Get('heads')
  @Permissions('fees.read')
  getFeeHeads(@Request() req: AuthenticatedRequest) {
    return this.feesService.getFeeHeads(req.tenant?.institutionId);
  }

  @Post('heads')
  @Permissions('fees.write')
  createFeeHead(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeeHeadDto) {
    return this.feesService.createFeeHead(req.tenant?.institutionId, dto);
  }

  @Delete('heads/:id')
  @Permissions('fees.write')
  deleteFeeHead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteFeeHead(req.tenant?.institutionId, id);
  }

  // ── Fee Structures ────────────────────────────────────────────────────────
  @Get('structures')
  @Permissions('fees.read')
  getFeeStructures(
    @Request() req: AuthenticatedRequest,
    @Query('unitId') unitId: string,
    @Query('yearId') yearId: string,
  ) {
    return this.feesService.getFeeStructures(req.tenant?.institutionId, unitId, yearId);
  }

  @Post('structures')
  @Permissions('fees.write')
  upsertFeeStructure(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeeStructureDto) {
    return this.feesService.upsertFeeStructure(req.tenant?.institutionId, dto);
  }

  // FIXED: now passes institutionId for proper tenant scoping
  @Delete('structures/:id')
  @Permissions('fees.write')
  deleteFeeStructure(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteFeeStructure(req.tenant?.institutionId, id);
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  @Post('payments')
  @Permissions('fees.write')
  recordPayment(@Request() req: AuthenticatedRequest, @Body() dto: RecordPaymentDto) {
    return this.feesService.recordPayment(req.tenant?.institutionId, dto);
  }

  // Collect multiple installments in one shot
  @Post('payments/bulk')
  @Permissions('fees.write')
  recordBulkPayments(@Request() req: AuthenticatedRequest, @Body() dto: RecordBulkPaymentDto) {
    return this.feesService.recordBulkPayments(req.tenant?.institutionId, dto);
  }

  @Get('payments/student/:studentId')
  @Permissions('fees.read')
  getStudentPayments(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string) {
    // C-05: pass parentUserId so service can enforce ownership for parent role
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentPayments(req.tenant?.institutionId, studentId, parentUserId);
  }

  // Installment-level dues for a student — used by the improved collect-fees UI
  @Get('payments/student/:studentId/installments')
  @Permissions('fees.read')
  getInstallmentDues(
    @Request() req: AuthenticatedRequest,
    @Param('studentId') studentId: string,
    @Query('yearId') yearId: string,
  ) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentInstallmentDues(req.tenant?.institutionId, studentId, yearId, parentUserId);
  }

  @Get('payments/student/:studentId/balance')
  @Permissions('fees.read')
  getBalance(
    @Request() req: AuthenticatedRequest,
    @Param('studentId') studentId: string,
    @Query('yearId') yearId: string,
  ) {
    // C-05: pass parentUserId so service can enforce ownership for parent role
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentBalance(req.tenant?.institutionId, studentId, yearId, parentUserId);
  }

  @Get('payments/summary')
  @Permissions('fees.read')
  getPaymentsSummary(@Request() req: AuthenticatedRequest) {
    return this.feesService.getPaymentsSummary(req.tenant?.institutionId);
  }

  @Get('payments/daily')
  @Permissions('fees.read')
  getDailyCollection(@Request() req: AuthenticatedRequest, @Query('date') date: string) {
    return this.feesService.getDailyCollection(req.tenant?.institutionId, date);
  }

  @Get('payments/:id')
  @Permissions('fees.read')
  getPaymentById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    // C-06: pass parentUserId so service enforces child ownership for parent role
    const parentUserId = req.user?.roles?.includes('parent')
      ? req.user.userId
      : undefined;
    return this.feesService.getPaymentById(req.tenant?.institutionId, id, parentUserId);
  }

  @Get('defaulters')
  @Permissions('fees.read')
  getDefaulters(
    @Request() req: AuthenticatedRequest,
    @Query('yearId') yearId: string,
    @Query('unitId') unitId: string,
  ) {
    return this.feesService.getDefaulters(req.tenant?.institutionId, yearId, unitId);
  }

  // ── Fee Due-Date Alerts ────────────────────────────────────────────────────

  /**
   * Operator / accountant only — requires BOTH fees.read AND students.read.
   * Parents only have fees.read, so they cannot reach this endpoint.
   */
  @Get('due-alerts')
  @Permissions('fees.read', 'students.read')
  getDueAlerts(@Request() req: AuthenticatedRequest, @Query('yearId') yearId: string) {
    return this.feesService.getDueAlerts(req.tenant?.institutionId, yearId || undefined);
  }

  /**
   * Parent portal — returns upcoming/overdue dues for the caller's linked children.
   * Non-parent callers get an empty array (no error, just nothing).
   */
  @Get('payments/monthly-trend')
  @Permissions('fees.read')
  getMonthlyTrend(@Request() req: AuthenticatedRequest, @Query('months') months: string) {
    return this.feesService.getMonthlyTrend(req.tenant?.institutionId, months ? parseInt(months) : 6);
  }

  @Get('my-children/upcoming-dues')
  @Permissions('fees.read')
  getChildrenUpcomingDues(@Request() req: AuthenticatedRequest) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : null;
    if (!parentUserId) return [];
    return this.feesService.getChildrenUpcomingDues(req.tenant?.institutionId, parentUserId);
  }
}
