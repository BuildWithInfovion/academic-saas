import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
  IsEmail,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class OnboardClientDto {
  // ── Identity ──────────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @IsString()
  @IsIn(['school', 'pre_school', 'college', 'coaching', 'university'])
  institutionType: string;

  @IsString()
  @IsNotEmpty()
  planCode: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9]+(?:[a-z0-9-]{0,18}[a-z0-9])?$/, {
    message: 'codeOverride may only contain lowercase letters, numbers, and hyphens',
  })
  codeOverride?: string;

  // ── School profile (education-specific) ───────────────────────────────────
  @IsOptional()
  @IsString()
  @IsIn(['CBSE', 'ICSE / ISC', 'IB', 'Cambridge IGCSE', 'State Board', 'NIOS', 'Others'])
  board?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  affiliationNo?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'English', 'Hindi', 'Marathi', 'Gujarati', 'Telugu', 'Tamil',
    'Kannada', 'Malayalam', 'Bengali', 'Bilingual', 'Multilingual', 'Other',
  ])
  mediumOfInstruction?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Co-education', 'Boys Only', 'Girls Only'])
  schoolGenderType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Private Unaided', 'Private Aided', 'Government', 'Central Government', 'Trust / NGO'])
  managementType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2099)
  foundedYear?: number;

  // ── Contact ────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'institutionPhone must be a 10-digit number' })
  institutionPhone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'institutionEmail must be a valid email' })
  institutionEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  website?: string;

  // ── Location ───────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Transform(trim)
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  state?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  institutionAddress?: string;

  // ── Subscription ──────────────────────────────────────────────────────────
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
  @Transform(trim)
  subscriptionStartDate?: string;

  // ── Operator account ──────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Transform(trim)
  adminName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'adminEmail must be a valid email address' })
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  adminPhone?: string;

  // ── Director account (optional) ───────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Transform(trim)
  directorName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'directorEmail must be a valid email address' })
  directorEmail?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  directorPhone?: string;

  // ── Notes ─────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Transform(trim)
  notes?: string;
}
