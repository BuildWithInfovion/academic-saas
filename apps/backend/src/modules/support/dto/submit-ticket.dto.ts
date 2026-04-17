import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SubmitTicketDto {
  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  @MaxLength(200, { message: 'Subject must be 200 characters or fewer' })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MaxLength(5000, { message: 'Message must be 5000 characters or fewer' })
  message: string;
}
