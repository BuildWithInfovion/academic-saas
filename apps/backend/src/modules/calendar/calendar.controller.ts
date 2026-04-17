import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar-event.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('calendar')
@UseGuards(AuthGuard, TenantGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  private getInstitutionId(req: any): string {
    return (
      req.tenant?.institutionId ||
      req.user?.institutionId ||
      req.headers['x-institution-id']
    );
  }

  private getUserId(req: any): string {
    return req.user?.userId || req.user?.sub || req.user?.id;
  }

  /**
   * GET /calendar/events
   * All authenticated users can view calendar events for their institution.
   * Optional query params: from, to (ISO date strings), eventType
   */
  @Get('events')
  findAll(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('eventType') eventType?: string,
  ) {
    const institutionId = this.getInstitutionId(req);
    return this.calendarService.findAll(institutionId, from, to, eventType);
  }

  /**
   * POST /calendar/events
   * Requires academic.write — admin (Operator) and principal only.
   */
  @Post('events')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  create(@Req() req: any, @Body() dto: CreateCalendarEventDto) {
    const institutionId = this.getInstitutionId(req);
    const userId = this.getUserId(req);
    return this.calendarService.create(institutionId, userId, dto);
  }

  /**
   * PATCH /calendar/events/:id
   * Requires academic.write — admin (Operator) and principal only.
   */
  @Patch('events/:id')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    const institutionId = this.getInstitutionId(req);
    return this.calendarService.update(institutionId, id, dto);
  }

  /**
   * DELETE /calendar/events/:id
   * Requires academic.write — admin (Operator) and principal only.
   */
  @Delete('events/:id')
  @UseGuards(RolesGuard)
  @Permissions('academic.write')
  remove(@Req() req: any, @Param('id') id: string) {
    const institutionId = this.getInstitutionId(req);
    return this.calendarService.remove(institutionId, id);
  }
}
