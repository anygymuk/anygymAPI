import {
  Controller,
  Get,
  Headers,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { AdminGymResponseDto } from './dto/admin-gym-response.dto';

@Controller('admin')
@UseGuards(Auth0Guard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get('user')
  async getAdminUser(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<AdminUserResponseDto> {
    try {
      this.logger.log(`GET /admin/user called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will find and return the admin user from admin_users table
      const adminUser = await this.usersService.findAdminUserByAuth0Id(auth0Id);

      return adminUser;
    } catch (error) {
      this.logger.error(`Error in getAdminUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('gyms')
  async getAdminGyms(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<AdminGymResponseDto[]> {
    try {
      this.logger.log(`GET /admin/gyms called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return gyms based on the user's role
      const gyms = await this.usersService.findAdminGyms(auth0Id);

      return gyms;
    } catch (error) {
      this.logger.error(`Error in getAdminGyms: ${error.message}`, error.stack);
      throw error;
    }
  }
}

