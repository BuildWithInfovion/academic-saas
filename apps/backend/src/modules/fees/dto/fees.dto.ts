import {
  IsNotEmpty, IsOptional, IsString, IsNumber, IsIn,
  IsDateString, IsPositive, Min,
} from 'class-validator';

export class CreateFeeHeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  isCustom?: boolean;
}

export class CreateFeeStructureDto {
  @IsString()
  @IsNotEmpty()
  academicUnitId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  feeHeadId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  installmentName?: string; // "Term 1", "Annual", etc.

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  feeHeadId: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsIn(['cash', 'online', 'cheque', 'dd', 'neft', 'upi'])
  paymentMode: string;

  @IsDateString()
  paidOn: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
