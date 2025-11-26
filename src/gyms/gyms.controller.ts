import { Controller, Get, Param, Query, Logger, ParseIntPipe } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { GetGymsDto } from './dto/get-gyms.dto';
import { GymDetailResponseDto } from './dto/gym-detail-response.dto';

@Controller('gyms')
export class GymsController {
  private readonly logger = new Logger(GymsController.name);

  constructor(private readonly gymsService: GymsService) {}

  @Get()
  async findAll(@Query() query: GetGymsDto) {
    try {
      return await this.gymsService.findAll(query);
    } catch (error) {
      this.logger.error('Error in findAll:', error);
      throw error;
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<GymDetailResponseDto> {
    try {
      this.logger.log(`GET /gyms/${id} called`);
      return await this.gymsService.findOne(id);
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      throw error;
    }
  }
}

