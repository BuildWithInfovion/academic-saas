import { Module } from '@nestjs/common';
import { TcService } from './tc.service';
import { TcController } from './tc.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TcController],
  providers: [TcService],
})
export class TcModule {}
