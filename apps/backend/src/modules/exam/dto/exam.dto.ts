import {
  IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean,
  IsDateString, IsIn, IsArray, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AddExamSubjectDto {
  @IsString()
  @IsNotEmpty()
  academicUnitId: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsOptional()
  @IsNumber()
  maxMarks?: number;

  @IsOptional()
  @IsNumber()
  passingMarks?: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}

export class ExamResultEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SaveResultsDto {
  @IsString()
  @IsNotEmpty()
  examId: string;

  @IsString()
  @IsNotEmpty()
  academicUnitId: string;

  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamResultEntryDto)
  entries: ExamResultEntryDto[];
}
