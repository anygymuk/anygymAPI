import { IsString, IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class SetRatingDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsInt()
  @IsNotEmpty()
  gym_id: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
