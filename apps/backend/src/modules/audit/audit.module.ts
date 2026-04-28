import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
})
export class AuditModule {}
