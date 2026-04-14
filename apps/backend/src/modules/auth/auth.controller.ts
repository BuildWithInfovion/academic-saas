import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';

const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  // Both frontend (app.buildwithinfovion.com) and backend (api.buildwithinfovion.com)
  // share the same root domain, so 'lax' is safe and 'domain' makes the cookie
  // visible to the Next.js middleware on the frontend subdomain.
  sameSite: 'lax' as const,
  domain: '.buildwithinfovion.com',
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 🔐 LOGIN — institution code in body, no header needed
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto.institutionCode,
      dto.email,
      dto.password,
    );
    res.cookie('auth_rt', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Strip refreshToken from the response body — it travels only via httpOnly cookie
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  // 🔄 REFRESH TOKEN — no tenant header needed; token hash identifies the session
  @Post('refresh')
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const reqCookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = bodyToken ?? reqCookies?.auth_rt;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const result = await this.authService.refreshByToken(refreshToken);

    res.cookie('auth_rt', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  // 🚪 LOGOUT
  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @Tenant() tenant: { institutionId: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('auth_rt', RT_COOKIE_OPTIONS);
    return this.authService.logout(req.user.userId, tenant.institutionId);
  }

  // 🔑 FORGOT PASSWORD — no auth needed, public
  @Post('forgot-password')
  async forgotPassword(
    @Body('institutionCode') institutionCode: string,
    @Body('identifier') identifier: string,
  ) {
    return this.authService.requestPasswordReset(institutionCode, identifier);
  }

  // 📋 LIST PENDING RESET REQUESTS — operator only (users.write required)
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Get('password-resets')
  async getPendingResets(@Tenant() tenant: { institutionId: string }) {
    return this.authService.getPendingResetRequests(tenant.institutionId);
  }

  // ✅ APPROVE RESET — operator only (users.write required)
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Post('password-resets/:id/approve')
  async approveReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.approveResetRequest(tenant.institutionId, id);
  }

  // ❌ REJECT RESET — operator only (users.write required)
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Post('password-resets/:id/reject')
  async rejectReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.rejectResetRequest(tenant.institutionId, id);
  }
}
