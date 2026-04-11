import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 🔐 LOGIN — institution code in body, no header needed
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.institutionCode, dto.email, dto.password);
  }

  // 🔄 REFRESH TOKEN
  @Post('refresh')
  async refresh(
    @Tenant() tenant: { institutionId: string },
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.authService.refresh(tenant.institutionId, refreshToken);
  }

  // 🚪 LOGOUT
  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Tenant() tenant: { institutionId: string }, @Req() req: any) {
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

  // 📋 LIST PENDING RESET REQUESTS — operator only
  @UseGuards(AuthGuard)
  @Get('password-resets')
  async getPendingResets(@Tenant() tenant: { institutionId: string }) {
    return this.authService.getPendingResetRequests(tenant.institutionId);
  }

  // ✅ APPROVE RESET — operator sets new password
  @UseGuards(AuthGuard)
  @Post('password-resets/:id/approve')
  async approveReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.approveResetRequest(tenant.institutionId, id);
  }

  // ❌ REJECT RESET
  @UseGuards(AuthGuard)
  @Post('password-resets/:id/reject')
  async rejectReset(
    @Tenant() tenant: { institutionId: string },
    @Param('id') id: string,
  ) {
    return this.authService.rejectResetRequest(tenant.institutionId, id);
  }
}
