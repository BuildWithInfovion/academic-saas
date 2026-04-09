import { Module } from '@nestjs/common';
import { AcademicService } from './academic.service';
import { AcademicController } from './academic.controller';
import { PrismaModule } from '../../prisma/prisma.module'; // ✅ ADD THIS

@Module({
  imports: [PrismaModule], // ✅ IMPORTANT
  controllers: [AcademicController],
  providers: [AcademicService],
})
export class AcademicModule {}