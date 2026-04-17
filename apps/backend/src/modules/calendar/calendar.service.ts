import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List events ────────────────────────────────────────────────────────────

  async findAll(
    institutionId: string,
    from?: string,
    to?: string,
    eventType?: string,
  ) {
    const where: any = { institutionId, deletedAt: null };

    if (from || to) {
      // Return events that overlap with the requested date window
      where.AND = [
        ...(from ? [{ endDate: { gte: new Date(from) } }] : []),
        ...(to   ? [{ startDate: { lte: new Date(to) } }] : []),
      ];
    }

    if (eventType) where.eventType = eventType;

    return this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        createdBy: { select: { email: true, phone: true } },
      },
    });
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(
    institutionId: string,
    userId: string,
    dto: CreateCalendarEventDto,
  ) {
    const start = new Date(dto.startDate);
    const end   = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }

    return this.prisma.calendarEvent.create({
      data: {
        institutionId,
        createdByUserId: userId,
        title:       dto.title.trim(),
        description: dto.description?.trim() ?? null,
        eventType:   dto.eventType,
        startDate:   start,
        endDate:     end,
        isAllDay:    dto.isAllDay ?? true,
      },
      include: {
        createdBy: { select: { email: true, phone: true } },
      },
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(
    institutionId: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
  ) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, institutionId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');

    const start = dto.startDate ? new Date(dto.startDate) : event.startDate;
    const end   = dto.endDate   ? new Date(dto.endDate)   : event.endDate;

    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }

    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.title       !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() ?? null }),
        ...(dto.eventType   !== undefined && { eventType: dto.eventType }),
        ...(dto.startDate   !== undefined && { startDate: start }),
        ...(dto.endDate     !== undefined && { endDate: end }),
        ...(dto.isAllDay    !== undefined && { isAllDay: dto.isAllDay }),
      },
      include: {
        createdBy: { select: { email: true, phone: true } },
      },
    });
  }

  // ── Delete (soft) ──────────────────────────────────────────────────────────

  async remove(institutionId: string, eventId: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, institutionId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
