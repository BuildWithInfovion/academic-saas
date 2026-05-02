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
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import type { TenantContext } from '../../common/guards/tenant.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@UseGuards(AuthGuard, RolesGuard) // ✅ Secured 
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users.write')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(tenant.institutionId, dto);
  }

  @Get()
  @Permissions('users.read')
  findAll(
    @Tenant() tenant: TenantContext,
    @Query('role') role?: string,
    @Query('phone') phone?: string,
    @Query('email') email?: string,
  ) {
    if (phone || email) return this.usersService.findByIdentifier(tenant.institutionId, phone, email);
    if (role) return this.usersService.findByRole(tenant.institutionId, role);
    return this.usersService.findAll(tenant.institutionId);
  }

  @Delete(':userId')
  @Permissions('users.write')
  delete(
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
  ) {
    return this.usersService.delete(tenant.institutionId, userId);
  }

  @Patch('me/profile')
  async updateProfile(
    @Tenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.usersService.updateProfile(
      tenant.institutionId,
      req.user.userId,
      body,
    );
  }

  @Post('me/change-password')
  async changePassword(
    @Tenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('oldPassword and newPassword are required');
    }
    return this.usersService.changePassword(
      tenant.institutionId,
      req.user.userId,
      oldPassword,
      newPassword,
    );
  }

  @Get(':userId/assignments')
  @Permissions('users.read')
  getAssignments(
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getAssignments(tenant.institutionId, userId);
  }

  /** Operator force-sets a password for any user in the institution */
  @Patch(':userId/set-password')
  @Permissions('users.write')
  setPassword(
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
    @Body('newPassword') newPassword: string,
  ) {
    if (!newPassword) throw new BadRequestException('newPassword is required');
    return this.usersService.setPasswordByOperator(tenant.institutionId, userId, newPassword);
  }

  // ── Staff Profile ──────────────────────────────────────────────────────────

  @Get(':userId/staff-profile')
  @Permissions('users.read')
  getStaffProfile(
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getStaffProfile(tenant.institutionId, userId);
  }

  @Patch(':userId/staff-profile')
  @Permissions('users.write')
  upsertStaffProfile(
    @Tenant() tenant: TenantContext,
    @Param('userId') userId: string,
    @Body() dto: Record<string, any>,
  ) {
    return this.usersService.upsertStaffProfile(tenant.institutionId, userId, dto);
  }

  @Post(':userId/roles')
  @Permissions('users.assignRole')
  assignRole(
    @Tenant() tenant: TenantContext,
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body('roleId') roleId: string,
  ) {
    return this.usersService.assignRole(
      tenant.institutionId,
      userId,
      roleId,
      req.user.roles,
    );
  }
}