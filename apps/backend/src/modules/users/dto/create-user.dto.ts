import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  // B2-05: at least one of email or phone must be provided
  @ValidateIf((o) => !o.phone)
  @IsEmail(
    { require_tld: true, allow_ip_domain: false },
    { message: 'A valid email address is required (e.g. name@school.com)' },
  )
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