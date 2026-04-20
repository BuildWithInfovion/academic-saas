import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsEmail,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian number',
  })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  fatherName: string;

  @IsString()
  @IsNotEmpty()
  motherName: string;

  @Matches(/^[6-9]\d{9}$/, {
    message: 'Parent phone must be a valid 10-digit Indian number',
  })
  parentPhone: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Secondary phone must be a valid 10-digit Indian number',
  })
  secondaryPhone?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsString()
  @IsNotEmpty()
  academicUnitId: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  religion?: string;

  @IsOptional()
  @IsString()
  casteCategory?: string;

  @IsOptional()
  @IsString()
  aadharNumber?: string;

  @IsOptional()
  @IsString()
  tcFromPrevious?: string;

  @IsOptional()
  @IsDateString()
  tcReceivedDate?: string;

  @IsOptional()
  @IsString()
  tcPreviousInstitution?: string;

  @IsOptional()
  @IsBoolean()
  hasDisability?: boolean;

  @IsOptional()
  @IsString()
  disabilityDetails?: string;
}
