import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

  // Returns teachers visible to anyone in the institution (for parent to pick)
  async getTeachers(institutionId: string) {
    const staffUsers = await this.prisma.user.findMany({
      where: {
        institutionId,
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { code: { in: ['teacher', 'class_teacher'] } } } },
      },
      select: {
        id: true,
        name: true,
        staffProfile: { select: { designation: true, department: true } },
        classTeacherOf: { select: { displayName: true, name: true }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    return staffUsers;
  }

  // List conversations for the calling user (parent or teacher)
  async listConversations(institutionId: string, userId: string, role: 'parent' | 'teacher') {
    const where = role === 'parent'
      ? { institutionId, parentUserId: userId }
      : { institutionId, teacherUserId: userId };

    return this.prisma.conversation.findMany({
      where,
      include: {
        parentUser:  { select: { id: true, name: true, phone: true } },
        teacherUser: { select: { id: true, name: true, staffProfile: { select: { designation: true } } } },
        student:     { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true, readAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Start or fetch existing conversation (parent only)
  async startConversation(
    institutionId: string,
    parentUserId: string,
    teacherUserId: string,
    studentId: string | undefined,
    subject: string | undefined,
  ) {
    // Verify teacher belongs to same institution
    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherUserId, institutionId, isActive: true },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    // Verify student is child of parent (if provided)
    if (studentId) {
      const child = await this.prisma.student.findFirst({
        where: { id: studentId, institutionId, parentUserId },
        select: { id: true },
      });
      if (!child) throw new ForbiddenException('Student is not linked to your account');
    }

    // Find existing conversation or create one per parent+teacher+student combo
    const existingConv = await this.prisma.conversation.findFirst({
      where: { institutionId, parentUserId, teacherUserId, studentId: studentId ?? null },
      include: {
        parentUser:  { select: { id: true, name: true } },
        teacherUser: { select: { id: true, name: true } },
        student:     { select: { id: true, firstName: true, lastName: true } },
        messages:    { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } },
      },
    });
    if (existingConv) return existingConv;

    return this.prisma.conversation.create({
      data: { institutionId, parentUserId, teacherUserId, studentId: studentId ?? null, subject: subject ?? null },
      include: {
        parentUser:  { select: { id: true, name: true } },
        teacherUser: { select: { id: true, name: true } },
        student:     { select: { id: true, firstName: true, lastName: true } },
        messages:    { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } },
      },
    });
  }

  // Get full conversation with messages
  async getConversation(institutionId: string, conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, institutionId },
      include: {
        parentUser:  { select: { id: true, name: true, phone: true } },
        teacherUser: { select: { id: true, name: true, staffProfile: { select: { designation: true } } } },
        student:     { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        messages:    { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, name: true } } } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.parentUserId !== userId && conv.teacherUserId !== userId) {
      throw new ForbiddenException('Not authorised to view this conversation');
    }
    // Mark unread messages as read
    await this.prisma.message.updateMany({
      where: { conversationId, readAt: null, senderId: { not: userId } },
      data: { readAt: new Date() },
    });
    return conv;
  }

  // Send a message in a conversation
  async sendMessage(institutionId: string, conversationId: string, senderId: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Message content is required');
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, institutionId },
      select: { id: true, parentUserId: true, teacherUserId: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.parentUserId !== senderId && conv.teacherUserId !== senderId) {
      throw new ForbiddenException('Not authorised to send in this conversation');
    }
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId, content: content.trim() },
        include: { sender: { select: { id: true, name: true } } },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return message;
  }

  // Count unread messages for a user
  async getUnreadCount(institutionId: string, userId: string) {
    const myConvs = await this.prisma.conversation.findMany({
      where: { institutionId, OR: [{ parentUserId: userId }, { teacherUserId: userId }] },
      select: { id: true },
    });
    const count = await this.prisma.message.count({
      where: {
        conversationId: { in: myConvs.map((c) => c.id) },
        senderId: { not: userId },
        readAt: null,
      },
    });
    return { unread: count };
  }
}
