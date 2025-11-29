import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { PassResponseDto } from '../passes/dto/pass-response.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
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
    onboardingCompleted?: boolean;
  }): Promise<{ message: string }> {
    try {
      this.logger.log(`Updating user with auth0_id: ${auth0Id}`);
      this.logger.log(`Update data received: ${JSON.stringify(updateData)}`);

      // First, verify the user exists
      const user = await this.userRepository.findOne({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Build update object with all fields to update
      const updateObject: any = {};
      let hasUpdates = false;

      if (updateData.fullName !== undefined) {
        updateObject.fullName = updateData.fullName;
        hasUpdates = true;
      }
      if (updateData.addressLine1 !== undefined) {
        updateObject.addressLine1 = updateData.addressLine1;
        hasUpdates = true;
      }
      if (updateData.addressLine2 !== undefined) {
        updateObject.addressLine2 = updateData.addressLine2;
        hasUpdates = true;
      }
      if (updateData.addressCity !== undefined) {
        updateObject.addressCity = updateData.addressCity;
        hasUpdates = true;
      }
      if (updateData.addressPostcode !== undefined) {
        updateObject.addressPostcode = updateData.addressPostcode;
        hasUpdates = true;
      }
      if (updateData.dateOfBirth !== undefined) {
        updateObject.dateOfBirth = updateData.dateOfBirth;
        hasUpdates = true;
      }
      if (updateData.emergencyContactName !== undefined) {
        updateObject.emergencyContactName = updateData.emergencyContactName;
        hasUpdates = true;
      }
      if (updateData.emergencyContactNumber !== undefined) {
        updateObject.emergencyContactNumber = updateData.emergencyContactNumber;
        hasUpdates = true;
      }
      if (updateData.onboardingCompleted !== undefined) {
        updateObject.onboardingCompleted = updateData.onboardingCompleted;
        hasUpdates = true;
      }

      if (!hasUpdates) {
        throw new Error('No fields provided for update');
      }

      // Use the most reliable approach: load entity, update properties, and save
      // This ensures TypeORM properly handles column name mapping
      Object.assign(user, updateObject);
      await this.userRepository.save(user);

      this.logger.log(`User updated successfully: ${auth0Id}`);
      return { message: 'User updated successfully' };
    } catch (error) {
      this.logger.error(`Error updating user: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findActivePass(auth0Id: string): Promise<PassResponseDto | { message: string }> {
    try {
      this.logger.log(`Looking up active pass for auth0_id: ${auth0Id}`);

      // Build query with joins to gyms and gym_chains
      const queryBuilder = this.gymPassRepository
        .createQueryBuilder('pass')
        .leftJoinAndSelect('pass.gym', 'gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
        .select([
          'pass.id',
          'pass.userId',
          'pass.gymId',
          'gym.name',
          'gym.gymChainId',
          'gymChain.name',
          'gymChain.logo',
          'pass.passCode',
          'pass.status',
          'pass.validUntil',
          'pass.usedAt',
          'pass.qrcodeUrl',
          'pass.createdAt',
          'pass.updatedAt',
          'pass.subscriptionTier',
        ])
        .where('pass.userId = :auth0Id', { auth0Id })
        .andWhere('pass.status = :status', { status: 'active' })
        .orderBy('pass.createdAt', 'DESC')
        .limit(1);

      const pass = await queryBuilder.getOne();

      if (!pass) {
        this.logger.log(`No active pass found for user: ${auth0Id}`);
        return { message: 'no active passes' };
      }

      this.logger.log(`Active pass found for user: ${auth0Id}, pass ID: ${pass.id}`);

      // Format dates and transform to response DTO
      const formatDate = (date: Date | null): string | null => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString();
        }
        if (typeof date === 'string') {
          return new Date(date).toISOString();
        }
        return null;
      };

      const response: PassResponseDto = {
        id: pass.id,
        user_id: pass.userId,
        gym_id: pass.gymId,
        gym_name: pass.gym?.name || null,
        gym_chain_id: pass.gym?.gymChainId || null,
        gym_chain_name: pass.gym?.gymChain?.name || null,
        gym_chain_logo: pass.gym?.gymChain?.logo || null,
        pass_code: pass.passCode,
        status: pass.status,
        valid_until: formatDate(pass.validUntil),
        used_at: formatDate(pass.usedAt),
        qrcode_url: pass.qrcodeUrl || null,
        created_at: formatDate(pass.createdAt) || '',
        updated_at: formatDate(pass.updatedAt) || '',
        subscription_tier: pass.subscriptionTier || null,
      };

      return this.removeEmptyValues(response) as PassResponseDto;
    } catch (error) {
      this.logger.error(
        `Error in findActivePass: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch active pass: ${error.message}`);
    }
  }
}

