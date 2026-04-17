import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

class SubmitTicketDto {
  subject: string;
  message: string;
  category?: string;
}

@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Any authenticated school user can submit a support ticket.
   * institutionId comes from the JWT (req.user), not from the header,
   * so this route does not depend on TenantGuard.
   */
  @Post('ticket')
  @UseGuards(AuthGuard)
  async submitTicket(@Request() req: any, @Body() dto: SubmitTicketDto) {
    const institutionId: string = req.user?.institutionId;
    const roles: string[] = req.user?.roles ?? [];

    if (!institutionId) {
      return { error: 'Not authenticated' };
    }

    // Fetch institution name for the ticket record
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true },
    });

    const ticket = await this.prisma.supportTicket.create({
      data: {
        institutionId,
        institutionName: institution?.name ?? 'Unknown',
        submittedBy: req.user?.email ?? req.user?.phone ?? 'unknown',
        submitterRole: roles[0] ?? 'user',
        subject: dto.subject?.trim() || '(No subject)',
        message: dto.message?.trim() || '',
        status: 'open',
      },
    });

    return { success: true, ticketId: ticket.id };
  }
}
