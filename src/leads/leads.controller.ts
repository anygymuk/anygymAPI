import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { NewsletterDto } from './dto/newsletter.dto';
import { GymGroupDto } from './dto/gym-group.dto';
import { InvestorDto } from './dto/investor.dto';
import { FormSuccessResponseDto } from './dto/form-success-response.dto';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { FormErrorFilter } from './filters/form-error.filter';

const formValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) => {
    const firstError = errors[0];
    const message =
      firstError?.constraints &&
      Object.values(firstError.constraints)[0];
    return new BadRequestException({
      error: message ?? 'Invalid request',
    });
  },
});

@ApiTags('leads')
@Controller('leads')
@UseGuards(RateLimitGuard)
@UseFilters(FormErrorFilter)
@UsePipes(formValidationPipe)
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(private readonly leadsService: LeadsService) {}

  @Post('newsletter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to the AnyGym newsletter' })
  async submitNewsletter(
    @Body() dto: NewsletterDto,
  ): Promise<FormSuccessResponseDto> {
    try {
      this.logger.log('POST /leads/newsletter called');
      return await this.leadsService.submitNewsletter(dto);
    } catch (error) {
      this.logger.error(
        `Error in submitNewsletter: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('gym-group')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a gym group partnership enquiry' })
  async submitGymGroup(
    @Body() dto: GymGroupDto,
  ): Promise<FormSuccessResponseDto> {
    try {
      this.logger.log('POST /leads/gym-group called');
      return await this.leadsService.submitGymGroup(dto);
    } catch (error) {
      this.logger.error(
        `Error in submitGymGroup: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('investor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an investor enquiry' })
  async submitInvestor(
    @Body() dto: InvestorDto,
  ): Promise<FormSuccessResponseDto> {
    try {
      this.logger.log('POST /leads/investor called');
      return await this.leadsService.submitInvestor(dto);
    } catch (error) {
      this.logger.error(
        `Error in submitInvestor: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
