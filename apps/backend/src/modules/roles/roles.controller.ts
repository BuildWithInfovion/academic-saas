import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import type { TenantContext } from '../../common/guards/tenant.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@UseGuards(AuthGuard, RolesGuard) // ✅ Secured
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions('roles.write')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(tenant.institutionId, dto);
  }

  @Get()
  @Permissions('roles.read')
  findAll(@Tenant() tenant: TenantContext) {
    return this.rolesService.findAll(tenant.institutionId);
  }
}