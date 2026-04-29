import {
  IsOptional,
  IsString,
  IsDateString,
  IsEmail,
  IsBoolean,
  Matches,
} from 'class-validator';

export class UpdateStudentDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() rollNo?: string;

  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() placeOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() motherTongue?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone must be a valid 10-digit Indian number' })
  phone?: string;

  @IsOptional() @IsEmail() email?: string;

  // Father
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() fatherOccupation?: string;
  @IsOptional() @IsString() fatherQualification?: string;
  @IsOptional() @IsEmail() fatherEmail?: string;
  @IsOptional() @IsString() fatherAadhar?: string;

  // Mother
  @IsOptional() @IsString() motherName?: string;
  @IsOptional() @IsString() motherOccupation?: string;
  @IsOptional() @IsString() motherQualification?: string;
  @IsOptional() @IsEmail() motherEmail?: string;
  @IsOptional() @IsString() motherAadhar?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Parent phone must be a valid 10-digit Indian number' })
  parentPhone?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Secondary phone must be a valid 10-digit Indian number' })
  secondaryPhone?: string;

  // Financial
  @IsOptional() @IsString() annualIncome?: string;
  @IsOptional() @IsBoolean() isEwsCategory?: boolean;

  // Emergency Contact
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactRelation?: string;
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Emergency contact must be a valid 10-digit Indian number' })
  emergencyContactPhone?: string;

  // Address
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() locality?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pinCode?: string;

  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsString() academicUnitId?: string;

  // Previous School / TC
  @IsOptional() @IsString() tcFromPrevious?: string;
  @IsOptional() @IsDateString() tcReceivedDate?: string;
  @IsOptional() @IsString() tcPreviousInstitution?: string;
  @IsOptional() @IsString() previousClass?: string;
  @IsOptional() @IsString() previousBoard?: string;
  @IsOptional() @IsString() previousMarks?: string;

  // Demographics
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() casteCategory?: string;
  @IsOptional() @IsString() aadharNumber?: string;

  // Health
  @IsOptional() @IsBoolean() hasDisability?: boolean;
  @IsOptional() @IsString() disabilityDetails?: string;
  @IsOptional() @IsString() medicalConditions?: string;
}
