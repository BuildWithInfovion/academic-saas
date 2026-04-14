import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_+=])/, {
    message:
      'New password must be at least 10 characters and include uppercase, lowercase, a number, and a special character (@$!%*?&#^()-_+=)',
  })
  newPassword: string;
}
