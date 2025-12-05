import {
  Controller,
  Get,
  Headers,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { ChainResponseDto } from './dto/chain-response.dto';

@Controller('chains')
@UseGuards(Auth0Guard)
export class ChainsController {
  private readonly logger = new Logger(ChainsController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getChains(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<ChainResponseDto[]> {
    try {
      this.logger.log(`GET /chains called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // Return all chains from the gym_chains table
      const chains = await this.usersService.findAllChains();

      return chains;
    } catch (error) {
      this.logger.error(`Error in getChains: ${error.message}`, error.stack);
      throw error;
    }
  }
}

