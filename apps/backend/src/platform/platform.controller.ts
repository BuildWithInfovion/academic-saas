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
import type { Response } from 'express';
import { PlatformService } from './platform.service';
import { PlatformGuard } from './platform.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { OnboardClientDto } from './dto/onboard-client.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginRateLimitGuard } from '../common/guards/login-rate-limit.guard';

const PLATFORM_RT_OPTIONS = {
  httpOnly: true,
  secure: true,
  // Both frontend (app.buildwithinfovion.com) and backend (api.buildwithinfovion.com)
  // share the same root domain, so 'lax' is safe and 'domain' makes the cookie
  // visible to the Next.js middleware on the frontend subdomain.
  sameSite: 'lax' as const,
  domain: '.buildwithinfovion.com',
  path: '/',
};

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  // M-08: Rate-limit platform admin login to prevent brute-force attacks.
  @Post('auth/login')
  @UseGuards(LoginRateLimitGuard)
  async login(
    @Body() dto: PlatformLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformService.login(dto.email, dto.password);
    // Set the token as an httpOnly cookie for Next.js middleware protection.
    // Also returned in the body so the frontend can store it in-memory.
    res.cookie('platform_rt', result.accessToken, {
      ...PLATFORM_RT_OPTIONS,
      maxAge: 24 * 60 * 60 * 1000,
    });
    return result;
  }

  // ── PROTECTED (PlatformGuard) ─────────────────────────────────────────────

  @UseGuards(PlatformGuard)
  @Get('auth/me')
  async getMe(@Req() req: any) {
    return this.platformService.getMe(req.platformAdmin.sub);
  }

  @UseGuards(PlatformGuard)
  @Post('auth/logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('platform_rt', PLATFORM_RT_OPTIONS);
    return { message: 'Logged out' };
  }

  @UseGuards(PlatformGuard, LoginRateLimitGuard)
  @Post('auth/change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.platformService.changePassword(
      req.platformAdmin.sub,
      dto.currentPassword,
      dto.newPassword,
    );
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
}
