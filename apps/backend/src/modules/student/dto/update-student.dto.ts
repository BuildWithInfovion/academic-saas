import {
  IsOptional,
  IsString,
  IsDateString,
  IsEmail,
  Matches,
} from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  rollNo?: string;

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

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  motherName?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Parent phone must be a valid 10-digit Indian number',
  })
  parentPhone?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Secondary phone must be a valid 10-digit Indian number',
  })
  secondaryPhone?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  academicUnitId?: string;

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
}
