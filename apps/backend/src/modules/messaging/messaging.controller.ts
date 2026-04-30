import { Controller, Get, Post, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('messages')
@UseGuards(AuthGuard, TenantGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // GET /messages/teachers — list teachers the parent can message
  @Get('teachers')
  getTeachers(@Req() req: any) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.messagingService.getTeachers(institutionId);
  }

  // GET /messages/unread — count unread messages for current user
  @Get('unread')
  getUnread(@Req() req: any) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.messagingService.getUnreadCount(institutionId, req.user?.userId);
  }

  // GET /messages/conversations — list my conversations
  @Get('conversations')
  list(@Req() req: any, @Query('role') role: string) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    const userRole = (role === 'teacher' || role === 'parent') ? role : 'parent';
    return this.messagingService.listConversations(institutionId, req.user?.userId, userRole);
  }

  // POST /messages/conversations — start or reopen a conversation (parent initiates)
  @Post('conversations')
  start(
    @Req() req: any,
    @Body() body: { teacherUserId: string; studentId?: string; subject?: string },
  ) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.messagingService.startConversation(
      institutionId,
      req.user?.userId,
      body.teacherUserId,
      body.studentId,
      body.subject,
    );
  }

  // GET /messages/conversations/:id — get conversation with messages
  @Get('conversations/:id')
  get(@Req() req: any, @Param('id') id: string) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.messagingService.getConversation(institutionId, id, req.user?.userId);
  }

  // POST /messages/conversations/:id/send — send a message
  @Post('conversations/:id/send')
  send(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const institutionId = req.tenant?.institutionId ?? req.user?.institutionId;
    return this.messagingService.sendMessage(institutionId, id, req.user?.userId, body.content);
  }
}
