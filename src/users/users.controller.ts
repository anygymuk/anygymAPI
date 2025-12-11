import {
  Controller,
  Get,
  Put,
  Headers,
  Body,
  ForbiddenException,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PassResponseDto } from '../passes/dto/pass-response.dto';

@Controller('user')
@UseGuards(Auth0Guard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUser(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<UserResponseDto> {
    try {
      this.logger.log(`GET /user called with auth0_id: ${auth0Id}`);
      
      // The Auth0Guard ensures auth0_id is present in headers
      // Fetch the user by the auth0_id from the header
      // This ensures users can only access their own data since we're using their auth0_id
      const user = await this.usersService.findOneByAuth0Id(auth0Id);

      // Additional security check: Verify the returned user matches the requested auth0_id
      if (user.auth0_id !== auth0Id) {
        this.logger.warn(`Auth0 ID mismatch: requested ${auth0Id}, got ${user.auth0_id}`);
        throw new ForbiddenException('Access denied: You can only access your own profile');
      }

      return user;
    } catch (error) {
      this.logger.error(`Error in getUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put('update')
  async updateUser(
    @Headers('auth0_id') auth0Id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`PUT /user/update called with auth0_id: ${auth0Id}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Convert DTO fields to entity field names
      const updateData: {
        fullName?: string;
        addressLine1?: string;
        addressLine2?: string;
        addressCity?: string;
        addressPostcode?: string;
        dateOfBirth?: Date;
        emergencyContactName?: string;
        emergencyContactNumber?: string;
        onboardingCompleted?: boolean;
        passNotificationConsent?: boolean;
        marketingConsent?: boolean;
      } = {};

      if (updateUserDto.full_name !== undefined) {
        updateData.fullName = updateUserDto.full_name;
      }
      if (updateUserDto.address_line1 !== undefined) {
        updateData.addressLine1 = updateUserDto.address_line1;
      }
      if (updateUserDto.address_line2 !== undefined) {
        updateData.addressLine2 = updateUserDto.address_line2;
      }
      if (updateUserDto.address_city !== undefined) {
        updateData.addressCity = updateUserDto.address_city;
      }
      if (updateUserDto.address_postcode !== undefined) {
        updateData.addressPostcode = updateUserDto.address_postcode;
      }
      if (updateUserDto.date_of_birth !== undefined) {
        updateData.dateOfBirth = new Date(updateUserDto.date_of_birth);
      }
      if (updateUserDto.emergency_contact_name !== undefined) {
        updateData.emergencyContactName = updateUserDto.emergency_contact_name;
      }
      if (updateUserDto.emergency_contact_number !== undefined) {
        updateData.emergencyContactNumber = updateUserDto.emergency_contact_number;
      }
      if (updateUserDto.onboarding_completed !== undefined) {
        updateData.onboardingCompleted = updateUserDto.onboarding_completed;
      }
      if (updateUserDto.pass_notification_consent !== undefined) {
        updateData.passNotificationConsent = updateUserDto.pass_notification_consent;
      }
      if (updateUserDto.marketing_consent !== undefined) {
        updateData.marketingConsent = updateUserDto.marketing_consent;
      }

      // Update the user - this ensures users can only update their own data
      return await this.usersService.update(auth0Id, updateData);
    } catch (error) {
      this.logger.error(`Error in updateUser: ${error.message}`, error.stack);
      
      if (error.message === 'No fields provided for update') {
        throw new BadRequestException('No fields provided for update');
      }
      if (error.message === 'User not found or no changes made') {
        throw new BadRequestException('User not found or no changes made');
      }
      
      throw new BadRequestException(`Failed to update user: ${error.message}`);
    }
  }

  @Get('active_pass')
  async getActivePass(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<PassResponseDto | { message: string }> {
    try {
      this.logger.log(`GET /user/active_pass called with auth0_id: ${auth0Id}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Fetch the active pass by the auth0_id from the header
      // This ensures users can only access their own passes
      const result = await this.usersService.findActivePass(auth0Id);

      // If result is a pass object, verify it belongs to the requesting user
      if ('id' in result && result.user_id !== auth0Id) {
        this.logger.warn(
          `Pass user_id mismatch: requested ${auth0Id}, got ${result.user_id}`,
        );
        throw new ForbiddenException('Access denied: You can only access your own passes');
      }

      return result;
    } catch (error) {
      this.logger.error(`Error in getActivePass: ${error.message}`, error.stack);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw error;
    }
  }
}

