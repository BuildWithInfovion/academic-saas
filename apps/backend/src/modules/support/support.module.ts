import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SupportController } from './support.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [SupportController],
})
export class SupportModule {}
