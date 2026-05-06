import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { PlatformService } from './platform.service';
import { PlatformGuard } from './platform.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { OnboardClientDto } from './dto/onboard-client.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PlatformRateLimitGuard } from './guards/platform-rate-limit.guard';

const IS_PROD = process.env.NODE_ENV === 'production';

const PLATFORM_RT_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  ...(IS_PROD ? { domain: '.buildwithinfovion.com' } : {}),
  path: '/',
};

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  // Platform login — stricter rate limit (5/30min) than the shared guard
  @Post('auth/login')
  @UseGuards(PlatformRateLimitGuard)
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.platformService.login(dto.email, dto.password, ip, userAgent);
    res.cookie('platform_rt', result.accessToken, {
      ...PLATFORM_RT_OPTIONS,
      maxAge: 24 * 60 * 60 * 1000,   // 24 h — aligned with JWT expiry
    });
    return result;
  }

  // Password reset — public, rate-limited (no auth required by design for internal tool)
  @Post('auth/request-reset')
  @UseGuards(PlatformRateLimitGuard)
  async requestPasswordReset(@Body() dto: RequestResetDto) {
    return this.platformService.requestPasswordReset(dto.email);
  }

  @Post('auth/reset-password')
  @UseGuards(PlatformRateLimitGuard)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.platformService.resetPassword(dto.token, dto.newPassword);
  }

  // ── PROTECTED (PlatformGuard) ─────────────────────────────────────────────

  @UseGuards(PlatformGuard)
  @Get('auth/me')
  async getMe(@Req() req: any) {
    return this.platformService.getMe(req.platformAdmin.sub);
  }

  @UseGuards(PlatformGuard)
  @Post('auth/logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.platformService.logout(req.platformAdmin.sub);
    res.clearCookie('platform_rt', PLATFORM_RT_OPTIONS);
    return { message: 'Logged out' };
  }

  @UseGuards(PlatformGuard)
  @Post('auth/change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.platformService.changePassword(
      req.platformAdmin.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @UseGuards(PlatformGuard)
  @Get('auth/login-logs')
  async getLoginLogs(@Req() req: any) {
    return this.platformService.getLoginLogs(req.platformAdmin.sub);
  }

  @UseGuards(PlatformGuard)
  @Get('stats')
  async getStats() {
    return this.platformService.getStats();
  }

  @UseGuards(PlatformGuard)
  @Get('clients')
  async getClients() {
    return this.platformService.getClients();
  }

  @UseGuards(PlatformGuard)
  @Post('clients')
  async onboardClient(@Body() dto: OnboardClientDto) {
    return this.platformService.onboardClient(dto);
  }

  @UseGuards(PlatformGuard)
  @Get('clients/:id')
  async getClientDetail(@Param('id') id: string) {
    return this.platformService.getClientDetail(id);
  }

  @UseGuards(PlatformGuard)
  @Patch('clients/:id/status')
  async updateClientStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.platformService.updateClientStatus(id, status);
  }

  @UseGuards(PlatformGuard)
  @Post('clients/:id/subscription')
  async upsertSubscription(
    @Param('id') id: string,
    @Body()
    body: {
      planName?: string;
      maxStudents?: number;
      pricePerUser?: number;
      billingCycleYears?: number;
      startDate?: string;
      endDate?: string;
      amountPaid?: number;
      paidAt?: string;
      notes?: string;
    },
  ) {
    return this.platformService.upsertSubscription(id, body);
  }

  @UseGuards(PlatformGuard)
  @Delete('clients/:id')
  async removeClient(@Param('id') id: string) {
    return this.platformService.removeClient(id);
  }

  // ── Support Tickets ───────────────────────────────────────────────────────

  @UseGuards(PlatformGuard)
  @Get('support-tickets')
  async getSupportTickets() {
    return this.platformService.getSupportTickets();
  }

  @UseGuards(PlatformGuard)
  @Patch('support-tickets/:id/resolve')
  async resolveTicket(@Param('id') id: string) {
    return this.platformService.resolveTicket(id);
  }
}
