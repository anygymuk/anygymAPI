import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PassesService } from './passes.service';
import { Auth0Guard } from '../users/guards/auth0.guard';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';

@Controller('user/passes')
@UseGuards(Auth0Guard)
export class PassesController {
  private readonly logger = new Logger(PassesController.name);

  constructor(private readonly passesService: PassesService) {}

  @Get()
  async getPasses(
    @Headers('auth0_id') auth0Id: string,
    @Query() query: GetPassesDto,
  ): Promise<PassResponseDto[]> {
    try {
      this.logger.log(`GET /user/passes called with auth0_id: ${auth0Id}${query.status ? `, status: ${query.status}` : ''}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Fetch the passes by the auth0_id from the header
      // This ensures users can only access their own passes
      const passes = await this.passesService.findByAuth0Id(auth0Id, query);

      // Verify all passes belong to the requesting user (security check)
      const unauthorizedPasses = passes.filter(pass => pass.user_id !== auth0Id);
      if (unauthorizedPasses.length > 0) {
        this.logger.warn(
          `Found ${unauthorizedPasses.length} pass(es) that don't match auth0_id: ${auth0Id}`,
        );
        // Filter out any unauthorized passes as an extra security measure
        return passes.filter(pass => pass.user_id === auth0Id);
      }

      return passes;
    } catch (error) {
      this.logger.error(`Error in getPasses: ${error.message}`, error.stack);
      throw error;
    }
  }
}

