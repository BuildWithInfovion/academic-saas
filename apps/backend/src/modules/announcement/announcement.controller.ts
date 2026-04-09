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
import { AnnouncementService } from './announcement.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Controller('announcements')
@UseGuards(AuthGuard, TenantGuard)
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
    return roles[0] ?? 'staff';
  }

  @Get()
  async findAll(@Req() req: any, @Query('role') role?: string) {
    const institutionId = this.getInstitutionId(req);
    const userRole = role ?? this.getRole(req);

    return this.announcementService.findAll(institutionId, userRole);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    const institutionId = this.getInstitutionId(req);
    const authorUserId = this.getUserId(req);

    return this.announcementService.create(institutionId, authorUserId, dto);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    const institutionId = this.getInstitutionId(req);

    return this.announcementService.update(institutionId, id, dto);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const institutionId = this.getInstitutionId(req);

    return this.announcementService.delete(institutionId, id);
  }
}
