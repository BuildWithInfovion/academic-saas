import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService } from '../cache/app-cache.service';

// ✅ Export this so other files can import it
export interface TenantContext {
  institutionId: string;
}

// Cache institution status for 5 minutes — institution suspensions are rare operator actions.
const INSTITUTION_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const institutionId =
      (request.headers['x-institution-id'] as string) ||
      (request as any).user?.institutionId;

    if (!institutionId) {
      throw new BadRequestException('Missing X-Institution-ID header');
    }

    const cacheKey = `inst:${institutionId}`;
    const cached = this.cache.get<{ active: boolean }>(cacheKey);

    if (cached) {
      if (!cached.active) throw new UnauthorizedException('Institution account is inactive or suspended');
    } else {
      // S2-02: Verify the institution actually exists and is active
      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!institution || institution.deletedAt) {
        throw new UnauthorizedException('Institution not found');
      }

      const active = institution.status === 'active';
      this.cache.set(cacheKey, { active }, INSTITUTION_CACHE_TTL_MS);

      if (!active) {
        throw new UnauthorizedException('Institution account is inactive or suspended');
      }
    }

    // ✅ Set request.tenant for tenant.decorator.ts to read
    (request as any).tenant = { institutionId };

    return true;
  }
}