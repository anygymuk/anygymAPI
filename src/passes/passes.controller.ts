import {
  Controller,
  Get,
  Post,
  Headers,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PassesService } from './passes.service';
import { Auth0Guard } from '../users/guards/auth0.guard';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';
import { GeneratePassDto } from './dto/generate-pass.dto';
import { PassesWithSubscriptionResponseDto } from './dto/passes-with-subscription-response.dto';

@Controller()
@UseGuards(Auth0Guard)
export class PassesController {
  private readonly logger = new Logger(PassesController.name);

  constructor(private readonly passesService: PassesService) {}

  @Get('user/passes')
  async getPasses(
    @Headers('auth0_id') auth0Id: string,
    @Query() query: GetPassesDto,
  ): Promise<PassesWithSubscriptionResponseDto> {
    try {
      this.logger.log(`GET /user/passes called with auth0_id: ${auth0Id}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Fetch the passes with subscription summary by the auth0_id from the header
      // This ensures users can only access their own passes
      const result = await this.passesService.findPassesWithSubscription(auth0Id);

      // Verify all passes belong to the requesting user (security check)
      const allPasses = [...result.active_passes, ...result.pass_history];
      const unauthorizedPasses = allPasses.filter(pass => pass.user_id !== auth0Id);
      if (unauthorizedPasses.length > 0) {
        this.logger.warn(
          `Found ${unauthorizedPasses.length} pass(es) that don't match auth0_id: ${auth0Id}`,
        );
        // Filter out any unauthorized passes as an extra security measure
        return {
          subscription: result.subscription,
          active_passes: result.active_passes.filter(pass => pass.user_id === auth0Id),
          pass_history: result.pass_history.filter(pass => pass.user_id === auth0Id),
        };
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in getPasses: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('generate_pass')
  async generatePass(
    @Headers('auth0_id') auth0Id: string,
    @Body() generatePassDto: GeneratePassDto,
  ): Promise<{ message: string; pass_id: number }> {
    try {
      this.logger.log(`POST /generate_pass called with auth0_id: ${auth0Id}, gym_id: ${generatePassDto.gym_id}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Generate pass using the auth0_id from the header
      return await this.passesService.generatePass(auth0Id, generatePassDto);
    } catch (error) {
      this.logger.error(`Error in generatePass: ${error.message}`, error.stack);
      throw error;
    }
  }
}

