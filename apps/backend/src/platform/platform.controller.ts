import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformGuard } from './platform.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { OnboardClientDto } from './dto/onboard-client.dto';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  @Post('auth/login')
  async login(@Body() dto: PlatformLoginDto) {
    return this.platformService.login(dto.email, dto.password);
  }

  // ── PROTECTED (PlatformGuard) ─────────────────────────────────────────────

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
