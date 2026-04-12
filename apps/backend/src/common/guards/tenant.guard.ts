import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

// ✅ Export this so other files can import it
export interface TenantContext {
  institutionId: string;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const institutionId =
      (request.headers['x-institution-id'] as string) ||
      (request as any).user?.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Missing X-Institution-ID header');
    }

    // S2-02: Verify the institution actually exists and is active
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!institution || institution.deletedAt) {
      throw new UnauthorizedException('Institution not found');
    }

    if (institution.status !== 'active') {
      throw new UnauthorizedException(
        'Institution account is inactive or suspended',
      );
    }

    // ✅ Set request.tenant for tenant.decorator.ts to read
    (request as any).tenant = { institutionId };

    return true;
  }
}