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
  purpose?: string;
}

// Cache user session data for 60 seconds.
// Short enough that permission/role changes take effect quickly;
// long enough to avoid a DB hit on every single request.
const USER_ACTIVE_CACHE_TTL_MS = 60 * 1000;

type CachedSession = {
  roles: string[];
  permissions: string[];
};

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

    // Reject intermediate TOTP pending tokens — they must not authenticate routes
    if (payload.purpose === 'totp_pending') {
      throw new UnauthorizedException('Two-factor authentication required');
    }

    const cacheKey = `user-session:${payload.sub}:${payload.institutionId}`;
    const cached = this.cache.get<CachedSession | false>(cacheKey);

    if (cached === undefined) {
      // Fetch user, institution status, and live role permissions in one go.
      const [user, institution] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            id: payload.sub,
            institutionId: payload.institutionId,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            roles: { include: { role: { select: { code: true, permissions: true } } } },
          },
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

      if (!isActive) {
        this.cache.set(cacheKey, false, USER_ACTIVE_CACHE_TTL_MS);
        if (!user) throw new UnauthorizedException('Account is inactive or has been removed');
        throw new UnauthorizedException('Institution account is inactive or suspended');
      }

      // Extract live roles + permissions from the DB (not from the stale JWT payload).
      const roles = user!.roles.map((ur) => ur.role.code);
      const permissions = [
        ...new Set(
          user!.roles.flatMap((ur) => ur.role.permissions as string[]),
        ),
      ];

      const session: CachedSession = { roles, permissions };
      this.cache.set(cacheKey, session, USER_ACTIVE_CACHE_TTL_MS);

      return { userId: payload.sub, institutionId: payload.institutionId, roles, permissions };
    }

    if (cached === false) {
      throw new UnauthorizedException('Account is inactive or has been removed');
    }

    return {
      userId: payload.sub,
      institutionId: payload.institutionId,
      roles: cached.roles,
      permissions: cached.permissions,
    };
  }
}
