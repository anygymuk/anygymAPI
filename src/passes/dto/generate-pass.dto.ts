import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePassDto {
  @IsNotEmpty()
  @IsString()
  auth0_id: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  gym_id: number;
}


