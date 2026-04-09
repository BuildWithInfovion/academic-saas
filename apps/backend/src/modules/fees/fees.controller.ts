import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeHeadDto, CreateFeeStructureDto, RecordPaymentDto } from './dto/fees.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('fees')
@UseGuards(AuthGuard, TenantGuard)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  // ── Fee Heads ─────────────────────────────────────────────────────────────
  @Get('heads')
  getFeeHeads(@Request() req: any) {
    return this.feesService.getFeeHeads(req.tenant?.institutionId);
  }

  @Post('heads')
  createFeeHead(@Request() req: any, @Body() dto: CreateFeeHeadDto) {
    return this.feesService.createFeeHead(req.tenant?.institutionId, dto);
  }

  @Delete('heads/:id')
  deleteFeeHead(@Request() req: any, @Param('id') id: string) {
    return this.feesService.deleteFeeHead(req.tenant?.institutionId, id);
  }

  // ── Fee Structures ────────────────────────────────────────────────────────
  @Get('structures')
  getFeeStructures(
    @Request() req: any,
    @Query('unitId') unitId: string,
    @Query('yearId') yearId: string,
  ) {
    return this.feesService.getFeeStructures(req.tenant?.institutionId, unitId, yearId);
  }

  @Post('structures')
  upsertFeeStructure(@Request() req: any, @Body() dto: CreateFeeStructureDto) {
    return this.feesService.upsertFeeStructure(req.tenant?.institutionId, dto);
  }

  @Delete('structures/:id')
  deleteFeeStructure(@Param('id') id: string) {
    return this.feesService.deleteFeeStructure(id);
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  @Post('payments')
  recordPayment(@Request() req: any, @Body() dto: RecordPaymentDto) {
    return this.feesService.recordPayment(req.tenant?.institutionId, dto);
  }

  @Get('payments/student/:studentId')
  getStudentPayments(@Request() req: any, @Param('studentId') studentId: string) {
    return this.feesService.getStudentPayments(req.tenant?.institutionId, studentId);
  }

  @Get('payments/student/:studentId/balance')
  getBalance(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('yearId') yearId: string,
  ) {
    return this.feesService.getStudentBalance(req.tenant?.institutionId, studentId, yearId);
  }

  @Get('payments/daily')
  getDailyCollection(@Request() req: any, @Query('date') date: string) {
    return this.feesService.getDailyCollection(req.tenant?.institutionId, date);
  }

  @Get('defaulters')
  getDefaulters(
    @Request() req: any,
    @Query('yearId') yearId: string,
    @Query('unitId') unitId: string,
  ) {
    return this.feesService.getDefaulters(req.tenant?.institutionId, yearId, unitId);
  }
}
