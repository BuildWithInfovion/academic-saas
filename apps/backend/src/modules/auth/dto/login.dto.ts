import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  institutionCode: string; // e.g. "stmary", "infovion-school"

  @IsString()
  @IsNotEmpty()
  email: string; // accepts email OR phone number

  @IsString()
  @MinLength(6)
  password: string;
}
