import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService } from '../../common/cache/app-cache.service';

export interface JwtPayload {
  sub: string;
  institutionId: string;
  roles: string[];
  permissions: string[];
}

// Cache user active-status for 30 seconds.
// Short enough that deactivated accounts are blocked within 30 s;
// long enough to eliminate the DB hit on every authenticated request.
const USER_ACTIVE_CACHE_TTL_MS = 30 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private cache: AppCacheService,
  ) {
    const secret = configService.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.institutionId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const cacheKey = `user-active:${payload.sub}:${payload.institutionId}`;
    const cached = this.cache.get<boolean>(cacheKey);

    if (cached === undefined) {
      // Verify user exists/active AND institution is not suspended — both in one round-trip.
      const [user, institution] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            id: payload.sub,
            institutionId: payload.institutionId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        }),
        this.prisma.institution.findUnique({
          where: { id: payload.institutionId },
          select: { status: true, deletedAt: true },
        }),
      ]);

      const isActive =
        !!user &&
        !!institution &&
        !institution.deletedAt &&
        institution.status === 'active';

      this.cache.set(cacheKey, isActive, USER_ACTIVE_CACHE_TTL_MS);

      if (!isActive) {
        if (!user) throw new UnauthorizedException('Account is inactive or has been removed');
        throw new UnauthorizedException('Institution account is inactive or suspended');
      }
    } else if (!cached) {
      throw new UnauthorizedException(
        'Account is inactive or has been removed',
      );
    }

    return {
      userId: payload.sub,
      institutionId: payload.institutionId,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
