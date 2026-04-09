import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class AssignSubjectDto {
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @IsOptional()
  @IsString()
  teacherUserId?: string;

  @IsOptional()
  isClassTeacher?: boolean;
}
