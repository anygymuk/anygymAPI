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
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { AdminGymsPaginatedResponseDto } from './dto/admin-gyms-paginated-response.dto';
import { AdminGymDetailResponseDto } from './dto/admin-gym-detail-response.dto';
import { UpdateAdminGymDto } from './dto/update-admin-gym.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { AdminMembersPaginatedResponseDto } from './dto/admin-members-paginated-response.dto';
import { AdminMemberViewResponseDto } from './dto/admin-member-view-response.dto';

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

  @Get('events')
  async getAdminEvents(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<EventResponseDto[]> {
    try {
      this.logger.log(`GET /admin/events called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return events based on the user's role
      const events = await this.usersService.findAdminEvents(auth0Id);

      return events;
    } catch (error) {
      this.logger.error(`Error in getAdminEvents: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('members')
  async getAdminMembers(
    @Headers('auth0_id') auth0Id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search?: string,
  ): Promise<AdminMembersPaginatedResponseDto> {
    try {
      this.logger.log(`GET /admin/members called with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return paginated members based on the user's role
      // If search is provided, pagination is ignored and all matching results are returned
      const result = await this.usersService.findAdminMembers(auth0Id, page, search);

      return result;
    } catch (error) {
      this.logger.error(`Error in getAdminMembers: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('members/view')
  async getAdminMemberView(
    @Headers('auth0_id') auth0Id: string,
    @Headers('member_auth0_id') memberAuth0Id: string,
  ): Promise<AdminMemberViewResponseDto> {
    try {
      this.logger.log(`GET /admin/members/view called with auth0_id: ${auth0Id}, member_auth0_id: ${memberAuth0Id}`);
      
      if (!memberAuth0Id) {
        throw new BadRequestException('member_auth0_id header is required');
      }

      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return member data with passes filtered by the admin's role
      const memberView = await this.usersService.findAdminMemberView(auth0Id, memberAuth0Id);

      return memberView;
    } catch (error) {
      this.logger.error(`Error in getAdminMemberView: ${error.message}`, error.stack);
      throw error;
    }
  }
}

