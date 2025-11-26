import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Removes null, undefined, and empty string values from an object
   */
  private removeEmptyValues<T>(obj: T): Partial<T> {
    const result: any = {};
    for (const key in obj) {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          result[key] = value;
        } else if (typeof value === 'object') {
          const cleaned = this.removeEmptyValues(value);
          if (Object.keys(cleaned).length > 0) {
            result[key] = cleaned;
          }
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }

  async findOneByAuth0Id(auth0Id: string): Promise<UserResponseDto> {
    try {
      this.logger.log(`Looking up user with auth0_id: ${auth0Id}`);
      
      // Find user by auth0_id - select only the columns we need
      const user = await this.userRepository
        .createQueryBuilder('user')
        .select([
          'user.auth0Id',
          'user.email',
          'user.fullName',
          'user.onboardingCompleted',
          'user.addressLine1',
          'user.addressLine2',
          'user.addressCity',
          'user.addressPostcode',
          'user.dateOfBirth',
          'user.stripeCustomerId',
          'user.emergencyContactName',
          'user.emergencyContactNumber',
        ])
        .where('user.auth0Id = :auth0Id', { auth0Id })
        .getOne();

      if (!user) {
        this.logger.warn(`User not found with auth0_id: ${auth0Id}`);
        throw new NotFoundException('User not found');
      }

      this.logger.log(`User found: ${user.email}`);

      // Safely format date_of_birth
      let dateOfBirth: string | null = null;
      if (user.dateOfBirth) {
        try {
          if (user.dateOfBirth instanceof Date) {
            dateOfBirth = user.dateOfBirth.toISOString().split('T')[0];
          } else if (typeof user.dateOfBirth === 'string') {
            // If it's already a string, try to format it
            dateOfBirth = new Date(user.dateOfBirth).toISOString().split('T')[0];
          }
        } catch (dateError) {
          this.logger.warn(`Error formatting date_of_birth: ${dateError.message}`);
        }
      }

      const response = {
        auth0_id: user.auth0Id || '',
        email: user.email || '',
        full_name: user.fullName || null,
        onboarding_completed: user.onboardingCompleted ?? false,
        address_line1: user.addressLine1 || null,
        address_line2: user.addressLine2 || null,
        address_city: user.addressCity || null,
        address_postcode: user.addressPostcode || null,
        date_of_birth: dateOfBirth,
        stripe_customer_id: user.stripeCustomerId || null,
        emergency_contact_name: user.emergencyContactName || null,
        emergency_contact_number: user.emergencyContactNumber || null,
      };
      return this.removeEmptyValues(response) as UserResponseDto;
    } catch (error) {
      this.logger.error(`Error in findOneByAuth0Id: ${error.message}`, error.stack);
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }

  async verifyAuth0IdMatches(auth0Id: string, requestedAuth0Id: string): Promise<boolean> {
    return auth0Id === requestedAuth0Id;
  }

  async update(auth0Id: string, updateData: {
    fullName?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressCity?: string;
    addressPostcode?: string;
    dateOfBirth?: Date;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
  }): Promise<{ message: string }> {
    try {
      this.logger.log(`Updating user with auth0_id: ${auth0Id}`);

      // Build update object with only provided fields
      const updateObject: any = {};
      
      if (updateData.fullName !== undefined) {
        updateObject.fullName = updateData.fullName;
      }
      if (updateData.addressLine1 !== undefined) {
        updateObject.addressLine1 = updateData.addressLine1;
      }
      if (updateData.addressLine2 !== undefined) {
        updateObject.addressLine2 = updateData.addressLine2;
      }
      if (updateData.addressCity !== undefined) {
        updateObject.addressCity = updateData.addressCity;
      }
      if (updateData.addressPostcode !== undefined) {
        updateObject.addressPostcode = updateData.addressPostcode;
      }
      if (updateData.dateOfBirth !== undefined) {
        updateObject.dateOfBirth = updateData.dateOfBirth;
      }
      if (updateData.emergencyContactName !== undefined) {
        updateObject.emergencyContactName = updateData.emergencyContactName;
      }
      if (updateData.emergencyContactNumber !== undefined) {
        updateObject.emergencyContactNumber = updateData.emergencyContactNumber;
      }

      // Check if there's anything to update
      if (Object.keys(updateObject).length === 0) {
        throw new Error('No fields provided for update');
      }

      // Update the user
      const result = await this.userRepository.update(
        { auth0Id },
        updateObject,
      );

      if (result.affected === 0) {
        throw new Error('User not found or no changes made');
      }

      this.logger.log(`User updated successfully: ${auth0Id}`);
      return { message: 'User updated successfully' };
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }
}

