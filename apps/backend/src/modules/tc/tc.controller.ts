import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TcService, RequestTcDto, RejectTcDto } from './tc.service';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

interface TenantContext {
  institutionId: string;
  planCode: string;
  features: Record<string, any>;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('tc')
export class TcController {
  constructor(private readonly tcService: TcService) {}

  /**
   * POST /tc
   * Operator or admin initiates a TC request for a specific student.
   */
  @Post()
  @Permissions('users.write')
  request(
    @Tenant() tenant: TenantContext,
    @Req() req: any,
    @Body() body: RequestTcDto & { studentId: string },
  ) {
    const { studentId, ...dto } = body;
    return this.tcService.request(tenant.institutionId, req.user?.userId, studentId, dto);
  }

  /**
   * GET /tc?status=pending_approval&studentId=xxx
   * List all TC requests, optionally filtered by status or student.
   */
  @Get()
  @Permissions('users.read')
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.tcService.findAll(tenant.institutionId, status, studentId);
  }

  /**
   * GET /tc/:id
   * Full TC detail including institution and student data (for document rendering).
   */
  @Get(':id')
  @Permissions('users.read')
  findOne(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.tcService.findOne(tenant.institutionId, id);
  }

  /**
   * PATCH /tc/:id/approve
   * Principal / operator approves the TC request.
   */
  @Patch(':id/approve')
  @Permissions('users.write')
  approve(@Tenant() tenant: TenantContext, @Req() req: any, @Param('id') id: string) {
    return this.tcService.approve(tenant.institutionId, req.user?.userId, id);
  }

  /**
   * PATCH /tc/:id/reject
   * Principal / operator rejects the TC request with a mandatory remark.
   */
  @Patch(':id/reject')
  @Permissions('users.write')
  reject(
    @Tenant() tenant: TenantContext,
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: RejectTcDto,
  ) {
    return this.tcService.reject(tenant.institutionId, req.user?.userId, id, body.remark);
  }

  /**
   * POST /tc/:id/issue
   * Generates the TC number, marks status as issued, marks student as transferred.
   * Returns full TC data for document rendering/printing.
   */
  @Post(':id/issue')
  @Permissions('users.write')
  issue(@Tenant() tenant: TenantContext, @Param('id') id: string) {
    return this.tcService.issue(tenant.institutionId, id);
  }
}
