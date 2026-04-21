import { Module } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { CoverService } from './cover.service';
import { CoverController } from './cover.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TimetableController, CoverController],
  providers: [TimetableService, CoverService],
})
export class TimetableModule {}
