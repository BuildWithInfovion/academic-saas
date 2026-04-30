import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import type { JwtUser } from '../../common/types/authenticated-request';

type AuthedReq = Request & { user: JwtUser };
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';
import { ParentLoginRateLimitGuard } from '../../common/guards/parent-login-rate-limit.guard';

const IS_PROD = process.env.NODE_ENV === 'production';

const RT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  ...(IS_PROD ? { domain: '.buildwithinfovion.com' } : {}),
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ── Email + Password login ─────────────────────────────────────────────────

  /**
   * POST /auth/login
   * Staff / operator login via email + password.
   * If TOTP is enabled, returns { requiresTOTP: true, totpToken } — the client
   * must call POST /auth/totp/authenticate to complete the session.
   */
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

    // TOTP required — do not set cookie yet; return pending token only
    if ('requiresTOTP' in result) return result;

    // Full session — set httpOnly refresh token cookie
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

  // ── TOTP second factor ─────────────────────────────────────────────────────

  /**
   * POST /auth/totp/authenticate
   * Completes the TOTP challenge after a successful password login.
   * Body: { totpToken, code }
   */
  @Post('totp/authenticate')
  @UseGuards(LoginRateLimitGuard)
  async totpAuthenticate(
    @Body('totpToken') totpToken: string,
    @Body('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.authenticateTotp(
      (totpToken ?? '').trim(),
      (code ?? '').replace(/\s/g, ''),
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

  // ── TOTP management (authenticated) ───────────────────────────────────────

  /**
   * GET /auth/totp/status
   * Returns whether TOTP is enabled for the current user and how many backup codes remain.
   */
  @UseGuards(AuthGuard)
  @Get('totp/status')
  async totpStatus(@Req() req: AuthedReq) {
    return this.authService.getTotpStatus(req.user.userId);
  }

  /**
   * POST /auth/totp/setup
   * Generates a new TOTP secret and returns a QR code data URL + the raw secret.
   * TOTP is NOT yet active — call POST /auth/totp/confirm to enable it.
   */
  @UseGuards(AuthGuard)
  @Post('totp/setup')
  async totpSetup(@Req() req: AuthedReq) {
    return this.authService.setupTotp(req.user.userId);
  }

  /**
   * POST /auth/totp/confirm
   * Confirms the user's authenticator app is working and enables TOTP.
   * Body: { code }  — the 6-digit code from the authenticator app
   * Returns 8 backup codes (shown once; store them safely).
   */
  @UseGuards(AuthGuard)
  @Post('totp/confirm')
  async totpConfirm(@Req() req: AuthedReq, @Body('code') code: string) {
    return this.authService.confirmTotp(
      req.user.userId,
      (code ?? '').replace(/\s/g, ''),
    );
  }

  /**
   * DELETE /auth/totp
   * Disables TOTP after verifying the current code (or a backup code).
   * Body: { code }
   */
  @UseGuards(AuthGuard)
  @Delete('totp')
  async totpDisable(@Req() req: AuthedReq, @Body('code') code: string) {
    await this.authService.disableTotp(
      req.user.userId,
      (code ?? '').replace(/\s/g, ''),
    );
    return { message: 'Two-factor authentication disabled' };
  }

  // ── Token refresh ──────────────────────────────────────────────────────────

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyToken?: string,
  ) {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const refreshToken = bodyToken ?? reqCookies['auth_rt'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const result = await this.authService.refreshByToken(refreshToken);
    res.cookie('auth_rt', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh-op')
  async refreshOp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const refreshToken = reqCookies['auth_rt_op'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const result = await this.authService.refreshByToken(refreshToken);
    res.cookie('auth_rt_op', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @Req() req: AuthedReq,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('auth_rt', RT_COOKIE_OPTIONS);
    res.clearCookie('auth_rt_op', RT_COOKIE_OPTIONS);
    // institutionId comes from the JWT payload — no TenantMiddleware needed for logout
    return this.authService.logout(req.user.userId, req.user.institutionId);
  }

  // ── Password reset (self-service via email OTP) ────────────────────────────

  /**
   * POST /auth/forgot-password
   * Sends a 6-digit OTP to the staff/operator's registered email.
   * Always returns a constant response (no user enumeration).
   * Body: { institutionCode, email }
   */
  @Post('forgot-password')
  async forgotPassword(
    @Body('institutionCode') institutionCode: string,
    @Body('email') email: string,
  ) {
    return this.authService.requestPasswordResetOtp(
      (institutionCode ?? '').trim().toLowerCase(),
      (email ?? '').trim(),
    );
  }

  /**
   * POST /auth/reset-password
   * Verifies the email OTP and sets the new password.
   * Body: { institutionCode, email, otp, newPassword }
   */
  @Post('reset-password')
  async resetPassword(
    @Body('institutionCode') institutionCode: string,
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.authService.resetPassword(
      (institutionCode ?? '').trim().toLowerCase(),
      (email ?? '').trim(),
      (otp ?? '').trim(),
      newPassword ?? '',
    );
  }

  // ── Operator: manage password reset requests (legacy audit trail) ──────────

  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Get('password-resets')
  async getPendingResets(@Tenant() tenant: { institutionId: string }) {
    return this.authService.getPendingResetRequests(tenant.institutionId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Post('password-resets/:id/approve')
  async approveReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.approveResetRequest(tenant.institutionId, id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Post('password-resets/:id/reject')
  async rejectReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.rejectResetRequest(tenant.institutionId, id);
  }

  // ── Operator: direct parent password reset ─────────────────────────────────

  /**
   * POST /auth/operator/reset-parent-password/:userId
   * Operator directly sets a new random password for a parent.
   * Returns { newPassword } — show once in the dashboard, then discard.
   */
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users.write')
  @Post('operator/reset-parent-password/:userId')
  async resetParentPassword(
    @Tenant() tenant: { institutionId: string },
    @Param('userId') userId: string,
  ) {
    return this.authService.resetParentPassword(tenant.institutionId, userId);
  }

  // ── Director: reset any staff member's password ───────────────────────────

  /**
   * POST /auth/director/reset-staff-password/:userId
   * Director sets a new random password for any staff member.
   * Returns { newPassword } — show once, then discard.
   */
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('institution.write')
  @Post('director/reset-staff-password/:userId')
  async resetStaffPassword(
    @Tenant() tenant: { institutionId: string },
    @Param('userId') userId: string,
  ) {
    return this.authService.resetStaffPassword(tenant.institutionId, userId);
  }

  // ── Parent: self-service password reset request ────────────────────────────

  /**
   * POST /auth/parent/request-password-reset
   * Parent submits their phone; creates a PasswordResetRequest for the operator.
   * Always returns success to prevent phone enumeration.
   */
  @Post('parent/request-password-reset')
  async requestParentPasswordReset(@Body('phone') phone: string) {
    return this.authService.requestParentPasswordReset((phone ?? '').trim());
  }

  // ── Parent login ───────────────────────────────────────────────────────────

  /**
   * POST /auth/parent/login
   * Phone + password login for parents.
   * Institution is auto-resolved from the phone number — no school code needed.
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

    res.cookie('auth_rt', result.refreshToken, {
      ...RT_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshToken: _rt, ...safe } = result;
    return safe;
  }
}
