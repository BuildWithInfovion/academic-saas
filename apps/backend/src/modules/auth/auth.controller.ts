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
import { OtpRateLimitGuard } from '../../common/guards/otp-rate-limit.guard';
import { ParentLoginRateLimitGuard } from '../../common/guards/parent-login-rate-limit.guard';

const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  // Same root domain as the frontend — SameSite=Lax is stricter and more secure.
  // Domain=.buildwithinfovion.com makes the cookie visible to all subdomains,
  // so Next.js middleware on app.buildwithinfovion.com can read it server-side.
  sameSite: 'lax' as const,
  domain: '.buildwithinfovion.com',
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 🔐 LOGIN — institution code in body, no header needed
  // Operators (admin role) get a separate cookie (auth_rt_op) so their session
  // never collides with portal users (parent, teacher, etc.) who share auth_rt.
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
    const roles: string[] =
      (result.user as { roles?: string[] } | undefined)?.roles ?? [];
    const cookieName = roles.includes('admin') ? 'auth_rt_op' : 'auth_rt';
    res.cookie(cookieName, result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Strip refreshToken from the response body — it travels only via httpOnly cookie
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  // 🔄 REFRESH TOKEN — portal users (parent, teacher, principal, etc.)
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

  // 🔄 REFRESH TOKEN — operators only (reads auth_rt_op cookie)
  @Post('refresh-op')
  async refreshOp(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reqCookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = reqCookies?.auth_rt_op;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const result = await this.authService.refreshByToken(refreshToken);

    res.cookie('auth_rt_op', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  // 🚪 LOGOUT — clears both cookie variants so either portal type is covered
  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @Tenant() tenant: { institutionId: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('auth_rt', RT_COOKIE_OPTIONS);
    res.clearCookie('auth_rt_op', RT_COOKIE_OPTIONS);
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

  // ──────────────────────────────────────────────────────────────────────────
  // OTP-BASED LOGIN  (school management / all staff roles)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/otp/request
   * Step 1 of OTP login: validate institution + phone, issue a 6-digit OTP.
   * Always returns a constant response regardless of whether the phone exists.
   * Rate-limited: 3 requests per 10 minutes per phone+institutionCode.
   */
  @Post('otp/request')
  @UseGuards(OtpRateLimitGuard)
  async requestOtp(
    @Body('institutionCode') institutionCode: string,
    @Body('phone') phone: string,
  ) {
    return this.authService.requestOtp(
      (institutionCode ?? '').trim().toLowerCase(),
      (phone ?? '').trim(),
    );
  }

  /**
   * POST /auth/otp/verify
   * Step 2 of OTP login: verify the OTP and issue JWT + refresh-token cookie.
   * Up to 5 wrong attempts per OTP record — exceeded attempts invalidate the record.
   */
  @Post('otp/verify')
  async verifyOtp(
    @Body('institutionCode') institutionCode: string,
    @Body('phone') phone: string,
    @Body('otp') otp: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(
      (institutionCode ?? '').trim().toLowerCase(),
      (phone ?? '').trim(),
      (otp ?? '').trim(),
    );

    const roles: string[] = result.user?.roles ?? [];
    const cookieName = roles.includes('admin') ? 'auth_rt_op' : 'auth_rt';
    res.cookie(cookieName, result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _rt, ...safe } = result;
    return safe;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARENT LOGIN  (phone + password, no institution code)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /auth/parent/login
   * Password-based login for parents only.
   * No institution code is required — the system automatically resolves the
   * parent's school from their registered phone number.
   * Rate-limited: 10 attempts per 15 minutes per IP + phone.
   */
  @Post('parent/login')
  @UseGuards(ParentLoginRateLimitGuard)
  async parentLogin(
    @Body('phone') phone: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.parentLogin(
      (phone ?? '').trim(),
      password ?? '',
    );

    // Parents always get the portal cookie (auth_rt), never the operator cookie.
    res.cookie('auth_rt', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _rt, ...safe } = result;
    return safe;
  }
}
