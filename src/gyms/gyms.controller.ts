import { Controller, Get, Query, Logger } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { GetGymsDto } from './dto/get-gyms.dto';

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
}

