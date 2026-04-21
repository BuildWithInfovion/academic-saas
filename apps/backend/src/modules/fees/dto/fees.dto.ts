import {
  IsNotEmpty, IsOptional, IsString, IsNumber, IsIn,
  IsDateString, IsPositive, Min, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  installmentName?: string;

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
  feeStructureId?: string;

  @IsOptional()
  @IsString()
  installmentName?: string;

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

export class BulkPaymentItemDto {
  @IsString()
  @IsNotEmpty()
  feeHeadId: string;

  @IsString()
  @IsNotEmpty()
  feeStructureId: string;

  @IsString()
  @IsNotEmpty()
  installmentName: string;

  @IsNumber()
  @Min(1)
  amount: number;
}

export class RecordBulkPaymentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentItemDto)
  items: BulkPaymentItemDto[];

  @IsIn(['cash', 'online', 'cheque', 'dd', 'neft', 'upi'])
  paymentMode: string;

  @IsDateString()
  paidOn: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
