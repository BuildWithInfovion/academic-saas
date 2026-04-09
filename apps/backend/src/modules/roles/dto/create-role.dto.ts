import { IsString, IsArray } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  code: string;

  @IsString()
  label: string;

  @IsArray()
  permissions: string[];
}