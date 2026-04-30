import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'connected',
        version: process.env.npm_package_version ?? '1.0.0',
        timestamp: new Date().toISOString(),
      };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return {
        status: 'degraded',
        db: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
