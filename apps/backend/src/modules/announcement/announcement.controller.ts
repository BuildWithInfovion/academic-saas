import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('announcements')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  private getRole(req: AuthenticatedRequest): string {
    const roles = req.user.roles;
    if (roles.includes('super_admin')) return 'super_admin';
    if (roles.includes('admin')) return 'admin';
    return roles[0] ?? 'staff';
  }

  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.announcementService.findAll(
      req.tenant.institutionId,
      this.getRole(req),
    );
  }

  @Post()
  @Permissions('subjects.read')
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementService.create(
      req.tenant.institutionId,
      req.user.userId,
      dto,
    );
  }

  @Patch(':id')
  @Permissions('subjects.read')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    const { institutionId, userId, permissions } = req.user;

    const announcement = await this.announcementService.findOne(
      institutionId,
      id,
    );
    if (
      announcement &&
      announcement.authorUserId !== userId &&
      !permissions.includes('subjects.write')
    ) {
      throw new ForbiddenException('You can only edit your own announcements');
    }

    return this.announcementService.update(institutionId, id, dto);
  }

  @Delete(':id')
  @Permissions('subjects.read')
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const { institutionId, userId, permissions } = req.user;

    const announcement = await this.announcementService.findOne(
      institutionId,
      id,
    );
    if (
      announcement &&
      announcement.authorUserId !== userId &&
      !permissions.includes('subjects.write')
    ) {
      throw new ForbiddenException(
        'You can only delete your own announcements',
      );
    }

    return this.announcementService.delete(institutionId, id);
  }
}
