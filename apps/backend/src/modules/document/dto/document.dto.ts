import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

// All document types required by Indian school admissions
export const DOCUMENT_TYPES = [
  'aadhaar',
  'birth_certificate',
  'previous_tc',
  'caste_certificate',
  'migration_certificate',
  'previous_marksheet',
  'medical_certificate',
  'income_certificate',
  'disability_certificate',
  'residential_proof',
  'passport_photo',
  'parent_id_proof',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  aadhaar: 'Aadhaar Card',
  birth_certificate: 'Birth Certificate',
  previous_tc: 'Transfer Certificate (Previous School)',
  caste_certificate: 'Caste Certificate',
  migration_certificate: 'Migration Certificate',
  previous_marksheet: 'Previous Year Marksheet',
  medical_certificate: 'Medical / Health Certificate',
  income_certificate: 'Income Certificate',
  disability_certificate: 'Disability Certificate',
  residential_proof: 'Residential Proof',
  passport_photo: 'Passport-size Photo',
  parent_id_proof: "Parent's ID Proof",
  other: 'Other Document',
};

export class SaveDocumentDto {
  @IsString()
  studentId: string;

  @IsIn(DOCUMENT_TYPES)
  type: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsString()
  url: string;

  @IsString()
  publicId: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sizeBytes?: number;
}

export class GetUploadSignatureDto {
  @IsString()
  studentId: string;
}
