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

@Controller('inquiries')
@UseGuards(AuthGuard, TenantGuard)
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  private getId(req: any): string {
    return (
      req.tenant?.institutionId ||
      req.user?.institutionId ||
      req.headers['x-institution-id']
    );
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateInquiryDto) {
    return this.inquiryService.create(this.getId(req), dto);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.inquiryService.findAll(this.getId(req), status, search);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.inquiryService.findOne(this.getId(req), id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.inquiryService.update(this.getId(req), id, dto);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.inquiryService.delete(this.getId(req), id);
  }
}
