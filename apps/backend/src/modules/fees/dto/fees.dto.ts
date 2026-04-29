import {
  IsNotEmpty, IsOptional, IsString, IsNumber, IsIn,
  IsDateString, IsPositive, Min, IsArray, ValidateNested,
  IsBoolean, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Legacy DTOs (kept for backward compat with old FeeHead/FeeStructure/FeePayment) ──

export class CreateFeeHeadDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() isCustom?: boolean;
}

export class CreateFeeStructureDto {
  @IsString() @IsNotEmpty() academicUnitId: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsString() @IsNotEmpty() feeHeadId: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() installmentName?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class RecordPaymentDto {
  @IsString() @IsNotEmpty() studentId: string;
  @IsString() @IsNotEmpty() feeHeadId: string;
  @IsOptional() @IsString() feeStructureId?: string;
  @IsOptional() @IsString() installmentName?: string;
  @IsOptional() @IsString() academicYearId?: string;
  @IsNumber() @Min(1) amount: number;
  @IsIn(['cash', 'online', 'cheque', 'dd', 'neft', 'upi']) paymentMode: string;
  @IsDateString() paidOn: string;
  @IsOptional() @IsString() remarks?: string;
}

export class BulkPaymentItemDto {
  @IsString() @IsNotEmpty() feeHeadId: string;
  @IsString() @IsNotEmpty() feeStructureId: string;
  @IsString() @IsNotEmpty() installmentName: string;
  @IsNumber() @Min(1) amount: number;
}

export class RecordBulkPaymentDto {
  @IsString() @IsNotEmpty() studentId: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BulkPaymentItemDto) items: BulkPaymentItemDto[];
  @IsIn(['cash', 'online', 'cheque', 'dd', 'neft', 'upi']) paymentMode: string;
  @IsDateString() paidOn: string;
  @IsOptional() @IsString() remarks?: string;
}

// ── V2 DTOs — Fee Plan System ─────────────────────────────────────────────────

export class CreateFeeCategoryDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() type?: string;
}

export class CreateFeePlanDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateFeePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddFeePlanItemDto {
  @IsString() @IsNotEmpty() feeCategoryId: string;
  @IsNumber() @IsPositive() totalAmount: number;
}

export class UpdateFeePlanItemDto {
  @IsNumber() @IsPositive() totalAmount: number;
}

export class AddFeePlanInstallmentDto {
  @IsString() @IsNotEmpty() label: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateFeePlanInstallmentDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsNumber() @IsPositive() amount?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class AssignClassesDto {
  @IsArray() @IsString({ each: true }) academicUnitIds: string[];
}

export class CopyFeePlanDto {
  @IsString() @IsNotEmpty() targetAcademicYearId: string;
  @IsOptional() @IsString() newName?: string;
}

export class AddConcessionDto {
  @IsString() @IsNotEmpty() studentId: string;
  @IsString() @IsNotEmpty() feePlanItemId: string;
  @IsNumber() @IsPositive() amount: number;
  @IsString() @IsNotEmpty() reason: string;
}

export class CollectionItemDto {
  @IsString() @IsNotEmpty() feePlanInstallmentId: string;
  @IsString() @IsNotEmpty() feePlanItemId: string;
  @IsString() @IsNotEmpty() feeCategoryId: string;
  @IsNumber() @Min(1) amount: number;
}

export class RecordCollectionDto {
  @IsString() @IsNotEmpty() studentId: string;
  @IsString() @IsNotEmpty() academicYearId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CollectionItemDto) items: CollectionItemDto[];
  @IsIn(['cash', 'online', 'cheque', 'dd', 'neft', 'upi']) paymentMode: string;
  @IsDateString() paidOn: string;
  @IsOptional() @IsString() remarks?: string;
}
