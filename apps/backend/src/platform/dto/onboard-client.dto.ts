import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
  Matches,
  IsEmail,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class OnboardClientDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @IsIn(['school', 'college'])
  institutionType: string;

  @IsString()
  @IsNotEmpty()
  planCode: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9]+(?:[a-z0-9-]{0,18}[a-z0-9])?$/, {
    message: 'codeOverride may contain only lowercase letters, numbers, and hyphens',
  })
  codeOverride?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxStudents: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pricePerUser?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  subscriptionYears?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subscriptionStartDate?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'adminEmail must be a valid email address' })
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminPhone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  adminName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}
