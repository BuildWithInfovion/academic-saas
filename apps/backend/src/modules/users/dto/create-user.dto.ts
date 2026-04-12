import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  // B2-05: at least one of email or phone must be provided
  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'A valid email is required when phone is not provided' })
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @MinLength(10, { message: 'A valid phone number is required when email is not provided' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;

  /** Role code to assign on creation (e.g. 'parent', 'teacher') */
  @IsOptional()
  @IsString()
  role?: string;
}