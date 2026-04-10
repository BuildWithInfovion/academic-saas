import { Controller, Post, Body, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

interface CreateInstitutionDto {
  name: string;
  code: string;
  planCode: string;
  institutionType: string;
}

interface UpdateInstitutionDto {
  name?: string;
  institutionType?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  board?: string;
}

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Post()
  async create(
    @Body() createInstitutionDto: CreateInstitutionDto,
  ): Promise<unknown> {
    return this.institutionService.create(createInstitutionDto);
  }

  @Get()
  async findAll() {
    return this.institutionService.findAll();
  }

  // GET /institution/me — returns current tenant's institution profile
  @Get('me')
  @UseGuards(AuthGuard, TenantGuard)
  async getMe(@Req() req: any) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.findById(institutionId);
  }

  // PATCH /institution/me — update current tenant's institution profile
  @Patch('me')
  @UseGuards(AuthGuard, TenantGuard)
  async updateMe(@Req() req: any, @Body() dto: UpdateInstitutionDto) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.updateProfile(institutionId, dto);
  }

  // POST /institution/:id/seed-defaults — seeds standard fee heads + subjects
  @Post(':id/seed-defaults')
  async seedDefaults(
    @Param('id') id: string,
    @Body() body: { institutionType?: string },
  ) {
    return this.institutionService.seedDefaults(id, body.institutionType);
  }

  // PATCH /institution/:id/code — set or update the institution login code
  @Post(':id/set-code')
  async setCode(
    @Param('id') id: string,
    @Body() body: { code: string },
  ) {
    return this.institutionService.setCode(id, body.code);
  }
}
