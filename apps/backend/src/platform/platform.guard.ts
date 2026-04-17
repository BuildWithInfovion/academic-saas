import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    const cookies = req.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.platform_rt;

    const token = auth?.startsWith('Bearer ')
      ? auth.slice(7)
      : cookieToken;

    if (!token) {
      throw new UnauthorizedException('Missing platform token');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired platform token');
    }

    if (payload.type !== 'platform_admin') {
      throw new UnauthorizedException('Not a platform admin token');
    }

    // Single-session enforcement: validate that the session ID in the JWT
    // matches what is currently stored in the DB. If the admin logged out or
    // logged in from another device, activeSessionId will differ → reject.
    if (payload.sid) {
      const admin = await this.prisma.platformAdmin.findUnique({
        where: { id: payload.sub },
        select: { activeSessionId: true, isActive: true },
      });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      if (admin.activeSessionId !== payload.sid) {
        throw new UnauthorizedException(
          'Session has been invalidated. Please log in again.',
        );
      }
    }

    req.platformAdmin = payload;
    return true;
  }
}
