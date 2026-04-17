import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
  IsDateString,
} from 'class-validator';

export const EVENT_TYPES = [
  'holiday',
  'exam',
  'event',
  'meeting',
  'vacation',
  'other',
] as const;

export class CreateCalendarEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsIn(EVENT_TYPES)
  eventType: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(EVENT_TYPES)
  eventType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;
}
