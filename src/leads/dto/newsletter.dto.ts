import { Equals, IsBoolean, IsEmail, IsNotEmpty } from 'class-validator';

export class NewsletterDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsBoolean()
  @Equals(true, { message: 'You must consent to receive marketing emails' })
  consent: boolean;
}
