import { Controller, Get, Query, Logger, HttpCode, HttpStatus, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { SetRatingDto } from './dto/set-rating.dto';

@Controller('rating')
export class RatingController {
  private readonly logger = new Logger(RatingController.name);

  constructor(private readonly gymsService: GymsService) {}

  @Get('set')
  @HttpCode(HttpStatus.OK)
  async setRating(
    @Query('user_id') userId: string,
    @Query('gym_id', ParseIntPipe) gymId: number,
    @Query('rating', ParseIntPipe) rating: number,
  ): Promise<{ message: string }> {
    try {
      // Validate required parameters
      if (!userId) {
        throw new BadRequestException('user_id is required');
      }

      // Validate rating is between 1 and 5
      if (rating < 1 || rating > 5) {
        throw new BadRequestException('rating must be a whole number between 1 and 5');
      }

      const setRatingDto: SetRatingDto = {
        user_id: userId,
        gym_id: gymId,
        rating: rating,
      };
      this.logger.log(`GET /rating/set called with: ${JSON.stringify(setRatingDto)}`);
      return await this.gymsService.setRating(setRatingDto);
    } catch (error) {
      this.logger.error(`Error in setRating: ${error.message}`, error.stack);
      throw error;
    }
  }
}
