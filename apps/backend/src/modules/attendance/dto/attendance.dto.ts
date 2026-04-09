import { IsDateString, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsIn(['present', 'absent', 'late', 'leave'])
  status: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SaveAttendanceDto {
  @IsString()
  @IsNotEmpty()
  academicUnitId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}
