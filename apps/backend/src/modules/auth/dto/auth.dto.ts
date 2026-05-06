import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class TotpAuthenticateDto {
  @IsString()
  @IsNotEmpty()
  totpToken: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  institutionCode: string;

  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  institutionCode: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  otp: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class ParentLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,15}$/, { message: 'phone must be 10–15 digits' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  password: string;
}

export class RequestParentPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10,15}$/, { message: 'phone must be 10–15 digits' })
  phone: string;
}

export class TotpCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}
