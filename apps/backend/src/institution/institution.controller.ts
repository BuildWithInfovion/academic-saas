import { Controller, Post, Body, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

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
  logoUrl?: string;
  principalName?: string;
  tagline?: string;
  affiliationNo?: string;
}

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  // Platform-level operation — protected; direct HTTP access requires institution.write
  @Post()
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Permissions('institution.write')
  async create(
    @Body() createInstitutionDto: CreateInstitutionDto,
  ): Promise<unknown> {
    return this.institutionService.create(createInstitutionDto);
  }

  // Requires auth — no cross-tenant listing exposed to anonymous callers
  @Get()
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Permissions('institution.read')
  async findAll(@Req() req: any) {
    // Scope to caller's institution only — never return all institutions
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.findById(institutionId);
  }

  // GET /institution/me — returns current tenant's institution profile
  @Get('me')
  @UseGuards(AuthGuard, TenantGuard)
  async getMe(@Req() req: any) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.findById(institutionId);
  }

  // GET /institution/me/logo-signature — Cloudinary signed upload URL for school logo
  @Get('me/logo-signature')
  @UseGuards(AuthGuard, TenantGuard)
  async getLogoSignature(@Req() req: any) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.getLogoSignature(institutionId);
  }

  // PATCH /institution/me — update current tenant's institution profile
  @Patch('me')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Permissions('institution.write')
  async updateMe(@Req() req: any, @Body() dto: UpdateInstitutionDto) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.institutionService.updateProfile(institutionId, dto);
  }

  // POST /institution/:id/seed-defaults — seeds standard fee heads + subjects
  @Post(':id/seed-defaults')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Permissions('institution.write')
  async seedDefaults(
    @Param('id') id: string,
    @Body() body: { institutionType?: string },
  ) {
    return this.institutionService.seedDefaults(id, body.institutionType);
  }

  // POST /institution/:id/set-code — set or update the institution login code
  @Post(':id/set-code')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Permissions('institution.write')
  async setCode(
    @Param('id') id: string,
    @Body() body: { code: string },
  ) {
    return this.institutionService.setCode(id, body.code);
  }
}
