import {
  Controller,
  Get,
  Put,
  Headers,
  Body,
  Query,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { AdminGymsPaginatedResponseDto } from './dto/admin-gyms-paginated-response.dto';
import { AdminGymDetailResponseDto } from './dto/admin-gym-detail-response.dto';
import { UpdateAdminGymDto } from './dto/update-admin-gym.dto';

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

  @Get('gyms/:id')
  async getAdminGymById(
    @Headers('auth0_id') auth0Id: string,
    @Param('id', ParseIntPipe) gymId: number,
  ): Promise<AdminGymDetailResponseDto> {
    try {
      this.logger.log(`GET /admin/gyms/${gymId} called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // check permissions based on role, and return the gym details
      const gym = await this.usersService.findAdminGymById(auth0Id, gymId);

      return gym;
    } catch (error) {
      this.logger.error(`Error in getAdminGymById: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('gyms')
  async getAdminGyms(
    @Headers('auth0_id') auth0Id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search?: string,
  ): Promise<AdminGymsPaginatedResponseDto> {
    try {
      this.logger.log(`GET /admin/gyms called with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return paginated gyms based on the user's role
      // If search is provided, pagination is ignored and all matching results are returned
      const result = await this.usersService.findAdminGyms(auth0Id, page, search);

      return result;
    } catch (error) {
      this.logger.error(`Error in getAdminGyms: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put('gyms/update')
  async updateAdminGym(
    @Headers('auth0_id') auth0Id: string,
    @Headers('gym_id') gymIdHeader: string,
    @Body() updateData: UpdateAdminGymDto,
  ): Promise<{ message: string }> {
    try {
      const gymId = parseInt(gymIdHeader, 10);
      if (isNaN(gymId)) {
        throw new Error('Invalid gym_id in header');
      }

      this.logger.log(`PUT /admin/gyms/update called with auth0_id: ${auth0Id}, gym_id: ${gymId}`);
      this.logger.log(`Request body received: ${JSON.stringify(updateData)}`);
      this.logger.log(`Request body keys: ${Object.keys(updateData).join(', ')}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // check permissions based on role, and update the gym
      const result = await this.usersService.updateAdminGym(auth0Id, gymId, updateData);

      return result;
    } catch (error) {
      this.logger.error(`Error in updateAdminGym: ${error.message}`, error.stack);
      throw error;
    }
  }
}

