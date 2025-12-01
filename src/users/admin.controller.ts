import {
  Controller,
  Get,
  Headers,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('admin')
@UseGuards(Auth0Guard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('user')
  async getAdminUser(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<UserResponseDto> {
    try {
      this.logger.log(`GET /admin/user called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return the user from app_users table
      const user = await this.usersService.findUserByAdminAuth0Id(auth0Id);

      return user;
    } catch (error) {
      this.logger.error(`Error in getAdminUser: ${error.message}`, error.stack);
      throw error;
    }
  }
}

