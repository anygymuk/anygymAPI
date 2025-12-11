import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { SetRatingDto } from './dto/set-rating.dto';

@Controller('rating')
export class RatingController {
  private readonly logger = new Logger(RatingController.name);

  constructor(private readonly gymsService: GymsService) {}

  @Post('set')
  @HttpCode(HttpStatus.OK)
  async setRating(@Body() setRatingDto: SetRatingDto): Promise<{ message: string }> {
    try {
      this.logger.log(`POST /rating/set called with: ${JSON.stringify(setRatingDto)}`);
      return await this.gymsService.setRating(setRatingDto);
    } catch (error) {
      this.logger.error(`Error in setRating: ${error.message}`, error.stack);
      throw error;
    }
  }
}
