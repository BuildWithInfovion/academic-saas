import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string, role?: string) {
    const now = new Date();
    const isAdmin = !role || role === 'super_admin' || role === 'admin';

    // For non-admins push role filter into DB so we don't load all rows then discard
    const extraWhere = isAdmin
      ? {}
      : {
          OR: [
            { targetRoles: { array_contains: 'all' } },
            { targetRoles: { array_contains: role } },
          ],
        };

    return this.prisma.announcement.findMany({
      where: {
        institutionId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...extraWhere,
      },
      include: { author: { select: { email: true } } },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async create(
    institutionId: string,
    authorUserId: string,
    dto: CreateAnnouncementDto,
  ) {
    return this.prisma.announcement.create({
      data: {
        institutionId,
        authorUserId,
        title: dto.title,
        body: dto.body,
        targetRoles: dto.targetRoles ?? ['all'],
        isPinned: dto.isPinned ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        author: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async findOne(institutionId: string, id: string) {
    return this.prisma.announcement.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  async update(
    institutionId: string,
    id: string,
    dto: Partial<CreateAnnouncementDto>,
  ) {
    const existing = await this.prisma.announcement.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.targetRoles !== undefined && {
          targetRoles: dto.targetRoles,
        }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
      },
      include: {
        author: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async delete(institutionId: string, id: string) {
    const existing = await this.prisma.announcement.findFirst({
      where: { id, institutionId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    await this.prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
