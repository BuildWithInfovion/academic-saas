import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    institutionId: string;
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
  }) {
    const {
      institutionId,
      userId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
    } = params;

    return this.prisma.auditLog.create({
      data: {
        institutionId,
        userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        ipAddress,
      },
    });
  }
}