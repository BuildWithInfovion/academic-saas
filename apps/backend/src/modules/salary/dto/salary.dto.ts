import {
  IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean,
  IsDateString, IsIn, IsInt, Min, Max, ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AllowanceItemDto {
  @IsString() @IsNotEmpty() name: string;
  @IsNumber() @Min(0) amount: number;
}

export class CreateSalaryStructureDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;

  @IsNumber() @Min(0) basicSalary: number;
  @IsOptional() @IsNumber() @Min(0) houseRentAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) medicalAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) transportAllowance?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherAllowances?: AllowanceItemDto[];

  @IsOptional() @IsNumber() @Min(0) providentFund?: number;
  @IsOptional() @IsNumber() @Min(0) professionalTax?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherDeductions?: AllowanceItemDto[];
}

export class UpdateSalaryStructureDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsNumber() @Min(0) basicSalary?: number;
  @IsOptional() @IsNumber() @Min(0) houseRentAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) medicalAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) transportAllowance?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherAllowances?: AllowanceItemDto[];

  @IsOptional() @IsNumber() @Min(0) providentFund?: number;
  @IsOptional() @IsNumber() @Min(0) professionalTax?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherDeductions?: AllowanceItemDto[];

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AssignSalaryProfileDto {
  @IsString() @IsNotEmpty() userId: string;
  @IsOptional() @IsString() structureId?: string;

  @IsNumber() @Min(0) basicSalary: number;
  @IsOptional() @IsNumber() @Min(0) houseRentAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) medicalAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) transportAllowance?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherAllowances?: AllowanceItemDto[];

  @IsOptional() @IsNumber() @Min(0) providentFund?: number;
  @IsOptional() @IsNumber() @Min(0) professionalTax?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherDeductions?: AllowanceItemDto[];

  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSalaryProfileDto {
  @IsOptional() @IsString() structureId?: string;

  @IsOptional() @IsNumber() @Min(0) basicSalary?: number;
  @IsOptional() @IsNumber() @Min(0) houseRentAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) medicalAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) transportAllowance?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherAllowances?: AllowanceItemDto[];

  @IsOptional() @IsNumber() @Min(0) providentFund?: number;
  @IsOptional() @IsNumber() @Min(0) professionalTax?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceItemDto)
  otherDeductions?: AllowanceItemDto[];

  @IsOptional() @IsDateString() effectiveFrom?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class GenerateSalaryDto {
  @IsInt() @Min(1) @Max(12) month: number;
  @IsInt() @Min(2000) year: number;
}

export class UpdateSalaryStatusDto {
  @IsIn(['pending', 'paid', 'on_hold']) status: string;
  @IsOptional() @IsDateString() paidOn?: string;
  @IsOptional() @IsIn(['cash', 'bank_transfer', 'cheque', 'upi', 'other']) paymentMode?: string;
  @IsOptional() @IsString() paymentReference?: string;
  @IsOptional() @IsString() remarks?: string;
}
