import {
  Controller,
  Get,
  Post,
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
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { AdminUserListItemDto } from './dto/admin-user-list-item.dto';
import { AdminLocationResponseDto } from './dto/admin-location-response.dto';
import { AdminPassResponseDto } from './dto/admin-pass-response.dto';
import { AdminPassesPaginatedResponseDto } from './dto/admin-passes-paginated-response.dto';
import { AdminCheckInResponseDto } from './dto/admin-check-in-response.dto';

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

  @Post('user/create')
  async createAdminUser(
    @Headers('auth0_id') auth0Id: string,
    @Body() createUserDto: CreateAdminUserDto,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`POST /admin/user/create called with auth0_id: ${auth0Id}`);
      this.logger.log(`Request body: ${JSON.stringify(createUserDto)}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // check permissions based on role, create user in Auth0, and create admin_user record
      const result = await this.usersService.createAdminUser(auth0Id, createUserDto);

      return result;
    } catch (error) {
      this.logger.error(`Error in createAdminUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('user_list')
  async getAdminUserList(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<AdminUserListItemDto[]> {
    try {
      this.logger.log(`GET /admin/user_list called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // The service will verify the auth0_id exists in admin_users table
      // and return admin users based on the user's role
      const userList = await this.usersService.findAdminUserList(auth0Id);

      return userList;
    } catch (error) {
      this.logger.error(`Error in getAdminUserList: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('locations')
  async getAdminLocations(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<AdminLocationResponseDto[]> {
    try {
      this.logger.log(`GET /admin/locations called with auth0_id: ${auth0Id}`);
      const locations = await this.usersService.findAdminLocations(auth0Id);
      return locations;
    } catch (error) {
      this.logger.error(`Error in getAdminLocations: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('passes')
  async getAdminPasses(
    @Headers('auth0_id') auth0Id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search?: string,
  ): Promise<AdminPassesPaginatedResponseDto> {
    try {
      this.logger.log(`GET /admin/passes called with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      const result = await this.usersService.findAdminPasses(auth0Id, page, search);
      return result;
    } catch (error) {
      this.logger.error(`Error in getAdminPasses: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('check_in')
  async checkInPass(
    @Headers('auth0_id') auth0Id: string,
    @Headers('pass_code') passCode: string,
  ): Promise<AdminCheckInResponseDto> {
    try {
      this.logger.log(`POST /admin/check_in called with auth0_id: ${auth0Id}, pass_code: ${passCode || 'none'}`);
      
      if (!passCode) {
        throw new BadRequestException('pass_code header is required');
      }

      const result = await this.usersService.checkInPass(auth0Id, passCode);
      return result;
    } catch (error) {
      this.logger.error(`Error in checkInPass: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('auth0/test')
  async testAuth0Connection(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      this.logger.log(`GET /admin/auth0/test called with auth0_id: ${auth0Id}`);
      
      // Verify admin user exists
      const adminUser = await this.usersService.findAdminUserByAuth0Id(auth0Id);
      
      // Test Auth0 connection
      const result = await this.usersService.testAuth0Connection();
      
      return {
        ...result,
        details: {
          ...result.details,
          adminUser: {
            role: adminUser.role,
            email: adminUser.email,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Error in testAuth0Connection: ${error.message}`, error.stack);
      throw error;
    }
  }
}

