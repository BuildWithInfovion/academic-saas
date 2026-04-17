import {
  Controller, Post, Body, UseGuards, Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitTicketDto } from './dto/submit-ticket.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Any authenticated school user can submit a support ticket.
   * institutionId and userId come from the JWT (req.user) — not from
   * the request header — so this route does not depend on TenantGuard.
   * Input validation is handled by the global ValidationPipe via SubmitTicketDto.
   */
  @Post('ticket')
  @UseGuards(AuthGuard)
  async submitTicket(@Request() req: any, @Body() body: SubmitTicketDto) {
    const userId: string | undefined = req.user?.userId;
    const institutionId: string | undefined = req.user?.institutionId;
    const roles: string[] = req.user?.roles ?? [];

    // AuthGuard guarantees these are present; throw proper 401 if somehow not.
    if (!userId || !institutionId) {
      throw new UnauthorizedException('Invalid session');
    }

    const subject = body.subject.trim();
    const message = body.message.trim();

    // Fetch institution name + submitter identity in one round-trip.
    const [institution, user] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true },
      }),
    ]);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        institutionId,
        institutionName: institution?.name ?? 'Unknown',
        submittedBy: user?.email ?? user?.phone ?? userId,
        submitterRole: roles[0] ?? 'user',
        subject,
        message,
        status: 'open',
      },
    });

    return { success: true, ticketId: ticket.id };
  }
}
