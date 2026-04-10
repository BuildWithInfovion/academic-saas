import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  institutionId: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
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

    // Verify user still exists, is active, and has not been removed.
    // This ensures deleted/deactivated accounts are blocked immediately,
    // even if their JWT hasn't expired yet.
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        institutionId: payload.institutionId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('Account is inactive or has been removed');
    }

    return {
      userId: payload.sub,
      institutionId: payload.institutionId,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}