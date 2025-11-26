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
}

