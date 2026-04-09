import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';

export class OnboardClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['school', 'college'])
  institutionType: string;

  @IsString()
  @IsNotEmpty()
  planCode: string;

  @IsOptional()
  @IsString()
  codeOverride?: string;

  @IsNumber()
  @Min(1)
  maxStudents: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pricePerUser?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  subscriptionYears?: number;

  @IsOptional()
  @IsString()
  subscriptionStartDate?: string;

  @IsOptional()
  @IsString()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
