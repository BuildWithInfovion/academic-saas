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

@Controller('announcements')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  private getInstitutionId(req: any): string {
    return (
      req.tenant?.institutionId ||
      req.user?.institutionId ||
      req.headers['x-institution-id']
    );
  }

  private getUserId(req: any): string {
    return req.user?.userId || req.user?.sub || req.user?.id;
  }

  private getRole(req: any): string {
    const roles: string[] = req.user?.roles ?? [];
    // Privilege-first: if the caller holds any admin-level role, treat them as admin
    // so a multi-role user (teacher + admin) always sees admin announcements.
    if (roles.includes('super_admin')) return 'super_admin';
    if (roles.includes('admin')) return 'admin';
    return roles[0] ?? 'staff';
  }

  // GET — any authenticated user; role derived from verified JWT, not query param
  @Get()
  async findAll(@Req() req: any) {
    const institutionId = this.getInstitutionId(req);
    return this.announcementService.findAll(institutionId, this.getRole(req));
  }

  // POST — staff only (subjects.read excludes student + parent)
  @Post()
  @Permissions('subjects.read')
  async create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    const institutionId = this.getInstitutionId(req);
    const authorUserId = this.getUserId(req);
    return this.announcementService.create(institutionId, authorUserId, dto);
  }

  // PATCH — author can edit their own; operators can edit any
  @Patch(':id')
  @Permissions('subjects.read')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    const institutionId = this.getInstitutionId(req);
    const userId = this.getUserId(req);
    const permissions: string[] = req.user?.permissions ?? [];

    // Fetch the announcement to verify authorship
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

  // DELETE — author can delete their own; operators can delete any
  @Delete(':id')
  @Permissions('subjects.read')
  async delete(@Req() req: any, @Param('id') id: string) {
    const institutionId = this.getInstitutionId(req);
    const userId = this.getUserId(req);
    const permissions: string[] = req.user?.permissions ?? [];

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
