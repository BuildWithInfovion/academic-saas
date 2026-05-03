import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import {
  CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto, RecordBulkPaymentDto,
  CreateFeeCategoryDto, CreateFeePlanDto, UpdateFeePlanDto,
  AddFeePlanItemDto, UpdateFeePlanItemDto,
  AddFeePlanInstallmentDto, UpdateFeePlanInstallmentDto,
  AssignClassesDto, CopyFeePlanDto, AddConcessionDto, RecordCollectionDto,
} from './dto/fees.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('fees')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ── Legacy: Fee Heads ──────────────────────────────────────────────────────
  @Get('heads')
  @Permissions('fees.read')
  getFeeHeads(@Request() req: AuthenticatedRequest) {
    return this.feesService.getFeeHeads(req.tenant.institutionId);
  }

  @Post('heads')
  @Permissions('fees.write')
  createFeeHead(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeeHeadDto) {
    return this.feesService.createFeeHead(req.tenant.institutionId, dto);
  }

  @Delete('heads/:id')
  @Permissions('fees.write')
  deleteFeeHead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteFeeHead(req.tenant.institutionId, id);
  }

  // ── Legacy: Fee Structures ─────────────────────────────────────────────────
  @Get('structures')
  @Permissions('fees.read')
  getFeeStructures(@Request() req: AuthenticatedRequest, @Query('unitId') unitId: string, @Query('yearId') yearId: string) {
    return this.feesService.getFeeStructures(req.tenant.institutionId, unitId, yearId);
  }

  @Post('structures')
  @Permissions('fees.write')
  upsertFeeStructure(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeeStructureDto) {
    return this.feesService.upsertFeeStructure(req.tenant.institutionId, dto);
  }

  @Delete('structures/:id')
  @Permissions('fees.write')
  deleteFeeStructure(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteFeeStructure(req.tenant.institutionId, id);
  }

  // ── Legacy: Payments ───────────────────────────────────────────────────────
  @Post('payments')
  @Permissions('fees.write')
  recordPayment(@Request() req: AuthenticatedRequest, @Body() dto: RecordPaymentDto) {
    return this.feesService.recordPayment(req.tenant.institutionId, dto);
  }

  @Post('payments/bulk')
  @Permissions('fees.write')
  recordBulkPayments(@Request() req: AuthenticatedRequest, @Body() dto: RecordBulkPaymentDto) {
    return this.feesService.recordBulkPayments(req.tenant.institutionId, dto);
  }

  @Get('payments/student/:studentId')
  @Permissions('fees.read')
  getStudentPayments(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentPayments(req.tenant.institutionId, studentId, parentUserId);
  }

  @Get('payments/student/:studentId/installments')
  @Permissions('fees.read')
  getInstallmentDues(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string, @Query('yearId') yearId: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentInstallmentDues(req.tenant.institutionId, studentId, yearId, parentUserId);
  }

  @Get('payments/student/:studentId/balance')
  @Permissions('fees.read')
  getBalance(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string, @Query('yearId') yearId: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentBalance(req.tenant.institutionId, studentId, yearId, parentUserId);
  }

  @Get('payments/summary')
  @Permissions('fees.read')
  getPaymentsSummary(@Request() req: AuthenticatedRequest) {
    return this.feesService.getPaymentsSummary(req.tenant.institutionId);
  }

  @Get('payments/daily')
  @Permissions('fees.read')
  getDailyCollection(@Request() req: AuthenticatedRequest, @Query('date') date: string) {
    return this.feesService.getDailyCollection(req.tenant.institutionId, date);
  }

  @Get('payments/monthly-trend')
  @Permissions('fees.read')
  getMonthlyTrend(@Request() req: AuthenticatedRequest, @Query('months') months: string) {
    return this.feesService.getMonthlyTrend(req.tenant.institutionId, months ? parseInt(months) : 6);
  }

  @Get('payments/:id')
  @Permissions('fees.read')
  getPaymentById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getPaymentById(req.tenant.institutionId, id, parentUserId);
  }

  @Get('defaulters')
  @Permissions('fees.read')
  getDefaulters(@Request() req: AuthenticatedRequest, @Query('yearId') yearId: string, @Query('unitId') unitId: string) {
    return this.feesService.getDefaulters(req.tenant.institutionId, yearId, unitId);
  }

  @Get('due-alerts')
  @Permissions('fees.read', 'students.read')
  getDueAlerts(@Request() req: AuthenticatedRequest, @Query('yearId') yearId: string) {
    return this.feesService.getDueAlerts(req.tenant.institutionId, yearId || undefined);
  }

  @Get('my-children/upcoming-dues')
  @Permissions('fees.read')
  getChildrenUpcomingDues(@Request() req: AuthenticatedRequest) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : null;
    if (!parentUserId) return [];
    return this.feesService.getChildrenUpcomingDues(req.tenant.institutionId, parentUserId);
  }

  // ── V2: Categories ─────────────────────────────────────────────────────────
  @Get('categories')
  @Permissions('fees.read')
  getCategories(@Request() req: AuthenticatedRequest) {
    return this.feesService.getCategories(req.tenant.institutionId);
  }

  @Post('categories')
  @Permissions('fees.write')
  createCategory(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeeCategoryDto) {
    return this.feesService.createCategory(req.tenant.institutionId, dto);
  }

  @Delete('categories/:id')
  @Permissions('fees.write')
  deleteCategory(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteCategory(req.tenant.institutionId, id);
  }

  // ── V2: Fee Plans ──────────────────────────────────────────────────────────
  @Get('plans')
  @Permissions('fees.read')
  getFeePlans(@Request() req: AuthenticatedRequest, @Query('yearId') yearId: string, @Query('unitId') unitId: string) {
    return this.feesService.getFeePlans(req.tenant.institutionId, yearId || undefined, unitId || undefined);
  }

  @Get('plans/:planId')
  @Permissions('fees.read')
  getFeePlan(@Request() req: AuthenticatedRequest, @Param('planId') planId: string) {
    return this.feesService.getFeePlan(req.tenant.institutionId, planId);
  }

  @Post('plans')
  @Permissions('fees.write')
  createFeePlan(@Request() req: AuthenticatedRequest, @Body() dto: CreateFeePlanDto) {
    return this.feesService.createFeePlan(req.tenant.institutionId, dto);
  }

  @Put('plans/:planId')
  @Permissions('fees.write')
  updateFeePlan(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Body() dto: UpdateFeePlanDto) {
    return this.feesService.updateFeePlan(req.tenant.institutionId, planId, dto);
  }

  @Delete('plans/:planId')
  @Permissions('fees.write')
  deleteFeePlan(@Request() req: AuthenticatedRequest, @Param('planId') planId: string) {
    return this.feesService.deleteFeePlan(req.tenant.institutionId, planId);
  }

  @Post('plans/:planId/copy')
  @Permissions('fees.write')
  copyFeePlan(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Body() dto: CopyFeePlanDto) {
    return this.feesService.copyFeePlan(req.tenant.institutionId, planId, dto);
  }

  // ── V2: Plan Items ─────────────────────────────────────────────────────────
  @Post('plans/:planId/items')
  @Permissions('fees.write')
  addPlanItem(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Body() dto: AddFeePlanItemDto) {
    return this.feesService.addPlanItem(req.tenant.institutionId, planId, dto);
  }

  @Put('plans/:planId/items/:itemId')
  @Permissions('fees.write')
  updatePlanItem(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Param('itemId') itemId: string, @Body() dto: UpdateFeePlanItemDto) {
    return this.feesService.updatePlanItem(req.tenant.institutionId, planId, itemId, dto);
  }

  @Delete('plans/:planId/items/:itemId')
  @Permissions('fees.write')
  deletePlanItem(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Param('itemId') itemId: string) {
    return this.feesService.deletePlanItem(req.tenant.institutionId, planId, itemId);
  }

  // ── V2: Plan Installments ──────────────────────────────────────────────────
  @Post('plans/:planId/items/:itemId/installments')
  @Permissions('fees.write')
  addInstallment(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Param('itemId') itemId: string, @Body() dto: AddFeePlanInstallmentDto) {
    return this.feesService.addInstallment(req.tenant.institutionId, planId, itemId, dto);
  }

  @Put('plans/:planId/items/:itemId/installments/:instId')
  @Permissions('fees.write')
  updateInstallment(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Param('itemId') itemId: string, @Param('instId') instId: string, @Body() dto: UpdateFeePlanInstallmentDto) {
    return this.feesService.updateInstallment(req.tenant.institutionId, planId, itemId, instId, dto);
  }

  @Delete('plans/:planId/items/:itemId/installments/:instId')
  @Permissions('fees.write')
  deleteInstallment(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Param('itemId') itemId: string, @Param('instId') instId: string) {
    return this.feesService.deleteInstallment(req.tenant.institutionId, planId, itemId, instId);
  }

  // ── V2: Class Assignment ───────────────────────────────────────────────────
  @Post('plans/:planId/classes')
  @Permissions('fees.write')
  assignClasses(@Request() req: AuthenticatedRequest, @Param('planId') planId: string, @Body() dto: AssignClassesDto) {
    return this.feesService.assignClassesToPlan(req.tenant.institutionId, planId, dto);
  }

  // ── V2: Concessions ────────────────────────────────────────────────────────
  @Get('concessions/student/:studentId')
  @Permissions('fees.read')
  getStudentConcessions(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string) {
    return this.feesService.getStudentConcessions(req.tenant.institutionId, studentId);
  }

  @Post('concessions')
  @Permissions('fees.write')
  addConcession(@Request() req: AuthenticatedRequest, @Body() dto: AddConcessionDto) {
    return this.feesService.addConcession(req.tenant.institutionId, dto, req.user?.userId);
  }

  @Delete('concessions/:id')
  @Permissions('fees.write')
  deleteConcession(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.feesService.deleteConcession(req.tenant.institutionId, id);
  }

  // ── V2: Student Ledger ─────────────────────────────────────────────────────
  @Get('ledger/student/:studentId')
  @Permissions('fees.read')
  getStudentLedger(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string, @Query('yearId') yearId: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentLedger(req.tenant.institutionId, studentId, yearId || undefined, parentUserId);
  }

  // ── V2: Collections ────────────────────────────────────────────────────────
  @Post('collections')
  @Permissions('fees.write')
  recordCollections(@Request() req: AuthenticatedRequest, @Body() dto: RecordCollectionDto) {
    return this.feesService.recordCollections(req.tenant.institutionId, dto, req.user?.userId);
  }

  @Get('collections/student/:studentId')
  @Permissions('fees.read')
  getStudentCollections(@Request() req: AuthenticatedRequest, @Param('studentId') studentId: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getStudentCollections(req.tenant.institutionId, studentId, parentUserId);
  }

  @Get('collections/:id')
  @Permissions('fees.read')
  getCollectionById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const parentUserId = req.user?.roles?.includes('parent') ? req.user.userId : undefined;
    return this.feesService.getCollectionById(req.tenant.institutionId, id, parentUserId);
  }

  @Get('v2/defaulters')
  @Permissions('fees.read')
  getV2Defaulters(@Request() req: AuthenticatedRequest, @Query('yearId') yearId: string, @Query('unitId') unitId: string) {
    return this.feesService.getV2DefaultersByPlan(req.tenant.institutionId, yearId, unitId || undefined);
  }
}
