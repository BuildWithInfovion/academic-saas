import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InquiryService } from './inquiry.service';
import { CreateInquiryDto, UpdateInquiryDto } from './dto/inquiry.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('inquiries')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post()
  @Permissions('inquiry.write')
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateInquiryDto) {
    return this.inquiryService.create(req.tenant.institutionId, dto);
  }

  @Get()
  @Permissions('inquiry.read')
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inquiryService.findAll(req.tenant.institutionId, status, search);
  }

  @Get(':id')
  @Permissions('inquiry.read')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.inquiryService.findOne(req.tenant.institutionId, id);
  }

  @Patch(':id')
  @Permissions('inquiry.write')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.inquiryService.update(req.tenant.institutionId, id, dto);
  }

  @Delete(':id')
  @Permissions('inquiry.write')
  delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.inquiryService.delete(req.tenant.institutionId, id);
  }
}
