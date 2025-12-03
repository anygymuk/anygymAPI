import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { AdminUser } from './entities/admin-user.entity';
import { Event } from './entities/event.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { GymChain } from '../gyms/entities/gym-chain.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { PassResponseDto } from '../passes/dto/pass-response.dto';
import { AdminGymResponseDto } from './dto/admin-gym-response.dto';
import { AdminGymsPaginatedResponseDto } from './dto/admin-gyms-paginated-response.dto';
import { AdminGymDetailResponseDto } from './dto/admin-gym-detail-response.dto';
import { UpdateAdminGymDto } from './dto/update-admin-gym.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { AdminMemberResponseDto } from './dto/admin-member-response.dto';
import { AdminMembersPaginatedResponseDto } from './dto/admin-members-paginated-response.dto';
import { AdminMemberViewResponseDto } from './dto/admin-member-view-response.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { AdminUserListItemDto } from './dto/admin-user-list-item.dto';
import { AdminLocationResponseDto } from './dto/admin-location-response.dto';
import { AdminPassResponseDto } from './dto/admin-pass-response.dto';
import { AdminPassesPaginatedResponseDto } from './dto/admin-passes-paginated-response.dto';
import { AdminCheckInResponseDto } from './dto/admin-check-in-response.dto';
import { Auth0Service } from './services/auth0.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
    private dataSource: DataSource,
    private auth0Service: Auth0Service,
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
      
      // Try using findOne first (simplest approach)
      let user = await this.userRepository.findOne({
        where: { auth0Id },
      });

      // If not found, try query builder with entity property
      if (!user) {
        this.logger.log(`findOne failed, trying query builder for auth0_id: ${auth0Id}`);
        user = await this.userRepository
          .createQueryBuilder('user')
          .where('user.auth0Id = :auth0Id', { auth0Id })
          .getOne();
      }

      // If still not found, try raw query to verify the data exists
      if (!user) {
        this.logger.log(`Query builder failed, trying raw query for auth0_id: ${auth0Id}`);
        const rawUser = await this.dataSource.query(
          `SELECT * FROM app_users WHERE auth0_id = $1`,
          [auth0Id]
        );
        
        if (rawUser && rawUser.length > 0) {
          this.logger.warn(`User found via raw query but not via TypeORM. Raw result: ${JSON.stringify(rawUser[0])}`);
          // If raw query finds it, there's a TypeORM mapping issue
          // Try to manually construct the user object
          const rawData = rawUser[0];
          user = this.userRepository.create({
            auth0Id: rawData.auth0_id,
            email: rawData.email,
            fullName: rawData.full_name,
            onboardingCompleted: rawData.onboarding_completed,
            addressLine1: rawData.address_line1,
            addressLine2: rawData.address_line2,
            addressCity: rawData.address_city,
            addressPostcode: rawData.address_postcode,
            dateOfBirth: rawData.date_of_birth ? new Date(rawData.date_of_birth) : null,
            stripeCustomerId: rawData.stripe_customer_id,
            emergencyContactName: rawData.emergency_contact_name,
            emergencyContactNumber: rawData.emergency_contact_number,
          });
        }
      }

      if (!user) {
        this.logger.warn(`User not found with auth0_id: ${auth0Id} after all query methods`);
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

      // Get current date/time for comparison
      const now = new Date();

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
        .andWhere('pass.validUntil IS NOT NULL')
        .andWhere('pass.validUntil > :now', { now })
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

  async findAdminUserByAuth0Id(auth0Id: string) {
    try {
      this.logger.log(`Looking up admin user with auth0_id: ${auth0Id}`);
      
      // Find the admin user in admin_users table with gym chain join
      const adminUser = await this.adminUserRepository
        .createQueryBuilder('adminUser')
        .leftJoinAndSelect('adminUser.gymChain', 'gymChain')
        .where('adminUser.auth0Id = :auth0Id', { auth0Id })
        .getOne();

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}`);

      // Build gym_chain object if it exists
      let gymChain = null;
      if (adminUser.gymChain) {
        gymChain = {
          name: adminUser.gymChain.name || null,
          logo_url: adminUser.gymChain.logo || null,
          brand_color: adminUser.gymChain.brandColor || null,
        };
      }

      // Return the admin user data
      return {
        auth0_id: adminUser.auth0Id,
        name: adminUser.name || null,
        email: adminUser.email || null,
        role: adminUser.role || null,
        permission: adminUser.permission || null,
        gym_chain: gymChain,
      };
    } catch (error) {
      this.logger.error(`Error in findAdminUserByAuth0Id: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin user: ${error.message}`);
    }
  }

  async findAdminGyms(auth0Id: string, page: number = 1, search?: string): Promise<AdminGymsPaginatedResponseDto> {
    try {
      this.logger.log(`Looking up admin user gyms with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      const isSearchMode = !!search;

      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      let queryBuilder = this.gymRepository
        .createQueryBuilder('gym')
        .select(['gym.id', 'gym.name', 'gym.address', 'gym.postcode', 'gym.city', 'gym.requiredTier']);

      // Based on role, apply different filters
      if (adminUser.role === 'admin') {
        // Return all gyms where gym_chain_id matches the admin user's gym_chain_id
        if (adminUser.gymChainId) {
          queryBuilder = queryBuilder.where('gym.gymChainId = :gymChainId', { gymChainId: adminUser.gymChainId });
          this.logger.log(`Filtering gyms for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          // Return empty result
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return all gyms where id exists in the user's access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          queryBuilder = queryBuilder.where('gym.id IN (:...gymIds)', { gymIds: adminUser.accessGyms });
          this.logger.log(`Filtering gyms for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          // Return empty result
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        // Return empty result
        return {
          results: [],
          pagination: {
            total_results: 0,
            page: isSearchMode ? 1 : page,
            result_set: '0 to 0',
          },
        };
      }

      // Apply search filter if search parameter is provided
      if (isSearchMode) {
        const searchPattern = `%${search}%`;
        queryBuilder = queryBuilder.andWhere(
          '(gym.name ILIKE :search OR gym.city ILIKE :search)',
          { search: searchPattern }
        );
        this.logger.log(`Applying search filter: ${search}`);
      }

      // Get total count before pagination
      const totalResults = await queryBuilder.getCount();
      this.logger.log(`Total gyms found: ${totalResults}`);

      // Apply pagination only if not in search mode
      if (isSearchMode) {
        // In search mode, return all results without pagination
        const gyms = await queryBuilder.getMany();
        this.logger.log(`Returning ${gyms.length} gyms from search (no pagination)`);

        // Transform to response DTO
        const results = gyms.map((gym) => ({
          id: gym.id,
          name: gym.name,
          address: gym.address,
          postcode: gym.postcode,
          city: gym.city,
          required_tier: gym.requiredTier,
        }));

        return {
          results,
          pagination: {
            total_results: totalResults,
            page: 1,
            result_set: totalResults > 0 ? `1 to ${totalResults}` : '0 to 0',
          },
        };
      } else {
        // Normal pagination mode
        const gyms = await queryBuilder
          .skip(offset)
          .take(pageSize)
          .getMany();

        this.logger.log(`Returning ${gyms.length} gyms for page ${page}`);

        // Calculate result_set string
        const startResult = totalResults > 0 ? offset + 1 : 0;
        const endResult = Math.min(offset + pageSize, totalResults);
        const resultSet = `${startResult} to ${endResult}`;

        // Transform to response DTO
        const results = gyms.map((gym) => ({
          id: gym.id,
          name: gym.name,
          address: gym.address,
          postcode: gym.postcode,
          city: gym.city,
          required_tier: gym.requiredTier,
        }));

        return {
          results,
          pagination: {
            total_results: totalResults,
            page: page,
            result_set: resultSet,
          },
        };
      }
    } catch (error) {
      this.logger.error(`Error in findAdminGyms: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin gyms: ${error.message}`);
    }
  }

  async findAdminGymById(auth0Id: string, gymId: number): Promise<AdminGymDetailResponseDto> {
    try {
      this.logger.log(`Looking up admin user gym by id with auth0_id: ${auth0Id}, gymId: ${gymId}`);
      
      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      // Find the gym by ID
      const gym = await this.gymRepository.findOne({
        where: { id: gymId },
      });

      if (!gym) {
        this.logger.warn(`Gym not found with id: ${gymId}`);
        throw new NotFoundException('Gym not found');
      }

      // Check permissions based on role
      if (adminUser.role === 'admin') {
        // Admin must have matching gym_chain_id
        if (adminUser.gymChainId !== gym.gymChainId) {
          this.logger.warn(`Admin user ${auth0Id} attempted to access gym ${gymId} with mismatched gym_chain_id`);
          throw new ForbiddenException('You do not have permission to access this gym');
        }
        this.logger.log(`Admin user ${auth0Id} has permission to access gym ${gymId}`);
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Gym admin/staff must have gym id in access_gyms array
        if (!adminUser.accessGyms || !adminUser.accessGyms.includes(gymId)) {
          this.logger.warn(`${adminUser.role} user ${auth0Id} attempted to access gym ${gymId} not in access_gyms`);
          throw new ForbiddenException('You do not have permission to access this gym');
        }
        this.logger.log(`${adminUser.role} user ${auth0Id} has permission to access gym ${gymId}`);
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        throw new ForbiddenException('Access denied: Invalid role');
      }

      // Format dates
      const formatDate = (date: Date | null): string => {
        if (!date) return '';
        if (date instanceof Date) {
          return date.toISOString();
        }
        if (typeof date === 'string') {
          return new Date(date).toISOString();
        }
        return '';
      };

      // Transform to response DTO
      return {
        id: gym.id,
        name: gym.name,
        address: gym.address,
        postcode: gym.postcode,
        city: gym.city,
        latitude: gym.latitude,
        longitude: gym.longitude,
        required_tier: gym.requiredTier,
        amenities: gym.amenities || null,
        opening_hours: gym.openingHours || null,
        phone: gym.phone || null,
        image_url: gym.imageUrl || null,
        created_at: formatDate(gym.createdAt),
        updated_at: formatDate(gym.updatedAt),
        status: gym.status,
      };
    } catch (error) {
      this.logger.error(`Error in findAdminGymById: ${error.message}`, error.stack);
      // Re-throw ForbiddenException and NotFoundException as-is
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin gym: ${error.message}`);
    }
  }

  async updateAdminGym(auth0Id: string, gymId: number, updateData: UpdateAdminGymDto): Promise<{ message: string }> {
    try {
      this.logger.log(`Updating admin gym with auth0_id: ${auth0Id}, gymId: ${gymId}`);
      this.logger.log(`Update data: ${JSON.stringify(updateData)}`);
      
      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      // Check if user role is admin, gym_admin, or gym_staff
      if (adminUser.role !== 'admin' && adminUser.role !== 'gym_admin' && adminUser.role !== 'gym_staff') {
        this.logger.warn(`User ${auth0Id} with role ${adminUser.role} attempted to update gym`);
        throw new ForbiddenException('Access denied: Invalid role');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      // Find the gym by ID
      const gym = await this.gymRepository.findOne({
        where: { id: gymId },
      });

      if (!gym) {
        this.logger.warn(`Gym not found with id: ${gymId}`);
        throw new NotFoundException('Gym not found');
      }

      // Check write permissions based on role
      if (adminUser.role === 'admin') {
        // Admin must have matching gym_chain_id
        if (adminUser.gymChainId !== gym.gymChainId) {
          this.logger.warn(`Admin user ${auth0Id} attempted to update gym ${gymId} with mismatched gym_chain_id`);
          throw new ForbiddenException('You do not have permission to update this gym');
        }
        this.logger.log(`Admin user ${auth0Id} has permission to update gym ${gymId}`);
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Gym admin/staff must have gym id in access_gyms array
        if (!adminUser.accessGyms || !adminUser.accessGyms.includes(gymId)) {
          this.logger.warn(`${adminUser.role} user ${auth0Id} attempted to update gym ${gymId} not in access_gyms`);
          throw new ForbiddenException('You do not have permission to update this gym');
        }
        this.logger.log(`${adminUser.role} user ${auth0Id} has permission to update gym ${gymId}`);
      }

      // Build update object with only provided fields
      const updateObject: any = {};
      let hasUpdates = false;

      if (updateData.name !== undefined) {
        updateObject.name = updateData.name;
        hasUpdates = true;
      }
      if (updateData.address !== undefined) {
        updateObject.address = updateData.address;
        hasUpdates = true;
      }
      if (updateData.postcode !== undefined) {
        updateObject.postcode = updateData.postcode;
        hasUpdates = true;
      }
      if (updateData.city !== undefined) {
        updateObject.city = updateData.city;
        hasUpdates = true;
      }
      if (updateData.latitude !== undefined) {
        updateObject.latitude = updateData.latitude;
        hasUpdates = true;
      }
      if (updateData.longitude !== undefined) {
        updateObject.longitude = updateData.longitude;
        hasUpdates = true;
      }
      if (updateData.required_tier !== undefined) {
        updateObject.requiredTier = updateData.required_tier;
        hasUpdates = true;
      }
      if (updateData.amenities !== undefined) {
        updateObject.amenities = updateData.amenities;
        hasUpdates = true;
      }
      if (updateData.opening_hours !== undefined) {
        updateObject.openingHours = updateData.opening_hours;
        hasUpdates = true;
      }
      if (updateData.phone !== undefined) {
        updateObject.phone = updateData.phone;
        hasUpdates = true;
      }
      if (updateData.image_url !== undefined) {
        updateObject.imageUrl = updateData.image_url;
        hasUpdates = true;
      }
      if (updateData.status !== undefined) {
        updateObject.status = updateData.status;
        hasUpdates = true;
      }

      if (!hasUpdates) {
        throw new Error('No fields provided for update');
      }

      // Always update the updated_at timestamp
      updateObject.updatedAt = new Date();

      // Update the gym
      Object.assign(gym, updateObject);
      await this.gymRepository.save(gym);

      // Create event record
      try {
        // Format the update request body for the event description
        const updateFields = Object.keys(updateData)
          .filter(key => updateData[key] !== undefined)
          .map(key => {
            const value = updateData[key];
            // Format the value nicely
            if (typeof value === 'object' && value !== null) {
              return `${key}: ${JSON.stringify(value)}`;
            }
            return `${key}: ${value}`;
          })
          .join(', ');
        
        const adminName = adminUser.name || 'Unknown';
        const adminEmail = adminUser.email || 'Unknown';
        const eventDescription = `Gym ${gymId} updated by ${adminName}, ${adminEmail}. Update made ${updateFields}`;

        this.logger.log(`Creating event record for gym ${gymId}, gymChainId: ${gym.gymChainId}`);

        const event = this.eventRepository.create({
          adminUser: auth0Id,
          gymId: gymId.toString(),
          gymChainId: gym.gymChainId ? gym.gymChainId.toString() : null,
          eventType: 'gym_update',
          eventDescription: eventDescription,
          createdAt: new Date(),
        });

        await this.eventRepository.save(event);
        this.logger.log(`Event record created for gym update: ${gymId}`);
      } catch (eventError) {
        // Log the error but don't fail the request if event creation fails
        this.logger.error(`Failed to create event record for gym update ${gymId}: ${eventError.message}`, eventError.stack);
        // Continue - the gym update was successful, event logging failure shouldn't break the request
      }

      this.logger.log(`Gym ${gymId} updated successfully by ${auth0Id}`);
      return { message: 'Gym updated successfully' };
    } catch (error) {
      this.logger.error(`Error in updateAdminGym: ${error.message}`, error.stack);
      // Re-throw ForbiddenException and NotFoundException as-is
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      if (error.message === 'No fields provided for update') {
        throw new Error('No fields provided for update');
      }
      throw new Error(`Failed to update admin gym: ${error.message}`);
    }
  }

  async findAdminEvents(auth0Id: string): Promise<EventResponseDto[]> {
    try {
      this.logger.log(`Looking up admin events with auth0_id: ${auth0Id}`);
      
      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      let queryBuilder = this.eventRepository
        .createQueryBuilder('event')
        .leftJoin(Gym, 'gym', 'CAST(event.gymId AS INTEGER) = gym.id')
        .select([
          'event.id AS event_id',
          'event.userId AS event_user_id',
          'event.adminUser AS event_admin_user',
          'event.gymId AS event_gym_id',
          'event.gymChainId AS event_gym_chain_id',
          'event.eventType AS event_event_type',
          'event.eventDescription AS event_event_description',
          'event.createdAt AS event_created_at',
          'gym.name AS gym_name',
        ]);

      // Based on role, apply different filters
      if (adminUser.role === 'admin') {
        // Return all events where gym_chain_id matches the admin user's gym_chain_id
        if (adminUser.gymChainId) {
          // Convert number to string for comparison since events.gym_chain_id is VARCHAR
          queryBuilder = queryBuilder.where('event.gymChainId = :gymChainId', { 
            gymChainId: adminUser.gymChainId.toString() 
          });
          this.logger.log(`Filtering events for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          // Return empty result
          return [];
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return all events where gym_id matches one of the user's gym_ids from access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          // Convert number array to string array for comparison since events.gym_id is VARCHAR
          const gymIdsAsStrings = adminUser.accessGyms.map(id => id.toString());
          queryBuilder = queryBuilder.where('event.gymId IN (:...gymIds)', { 
            gymIds: gymIdsAsStrings 
          });
          this.logger.log(`Filtering events for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          // Return empty result
          return [];
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        // Return empty result
        return [];
      }

      // Get all matching events with joins
      const events = await queryBuilder.getRawMany();
      this.logger.log(`Found ${events.length} events`);

      // Transform to response DTO
      const results = events.map((row) => ({
        id: row.event_id,
        user_id: row.event_user_id,
        admin_user: row.event_admin_user,
        gym_id: row.event_gym_id,
        gym_chain_id: row.event_gym_chain_id,
        gym_name: row.gym_name || null,
        event_type: row.event_event_type,
        event_description: row.event_event_description,
        created_at: row.event_created_at,
      }));

      return results;
    } catch (error) {
      this.logger.error(`Error in findAdminEvents: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin events: ${error.message}`);
    }
  }

  async findAdminMembers(auth0Id: string, page: number = 1, search?: string): Promise<AdminMembersPaginatedResponseDto> {
    try {
      this.logger.log(`Looking up admin members with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      const isSearchMode = !!search;

      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      const now = new Date();

      // Build base query with joins
      let queryBuilder = this.gymPassRepository
        .createQueryBuilder('pass')
        .leftJoin('pass.user', 'user')
        .leftJoin('pass.gym', 'gym')
        .select([
          'user.auth0Id AS auth0_id',
          'user.email AS member_email',
          'COUNT(pass.id) AS passes',
          'MAX(pass.createdAt) AS last_visit',
          'MAX(CASE WHEN pass.validUntil IS NOT NULL AND pass.validUntil > :now THEN 1 ELSE 0 END) AS has_active_pass',
        ])
        .groupBy('user.auth0Id')
        .addGroupBy('user.email')
        .setParameter('now', now);

      // Apply role-based filtering
      if (adminUser.role === 'admin') {
        // Return all members who have generated passes for gyms matching the admin's gym_chain_id
        if (adminUser.gymChainId) {
          queryBuilder = queryBuilder.where('gym.gymChainId = :gymChainId', {
            gymChainId: adminUser.gymChainId,
          });
          this.logger.log(`Filtering members for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return all members who have generated passes for gyms in the access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          queryBuilder = queryBuilder.where('gym.id IN (:...gymIds)', {
            gymIds: adminUser.accessGyms,
          });
          this.logger.log(`Filtering members for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        return {
          results: [],
          pagination: {
            total_results: 0,
            page: isSearchMode ? 1 : page,
            result_set: '0 to 0',
          },
        };
      }

      // Apply search filter if search parameter is provided
      if (isSearchMode) {
        const searchPattern = `%${search}%`;
        queryBuilder = queryBuilder.andWhere('user.email ILIKE :search', { search: searchPattern });
        this.logger.log(`Applying search filter: ${search}`);
      }

      // Get total count before pagination
      // Since we're grouping by user.auth0Id and user.email, we need to count distinct users
      // We'll execute the query first to get the count of distinct groups
      const allResults = await queryBuilder.getRawMany();
      const totalResults = allResults.length;
      this.logger.log(`Total members found: ${totalResults}`);

      // Apply pagination only if not in search mode
      if (isSearchMode) {
        // In search mode, return all results without pagination
        this.logger.log(`Returning ${allResults.length} members from search (no pagination)`);

        // Transform to response DTO
        const members = allResults.map((row) => ({
          auth0_id: row.auth0_id,
          member_email: row.member_email,
          passes: parseInt(row.passes, 10),
          last_visit: row.last_visit ? new Date(row.last_visit) : null,
          has_active_pass: parseInt(row.has_active_pass, 10) === 1,
        }));

        return {
          results: members,
          pagination: {
            total_results: totalResults,
            page: 1,
            result_set: totalResults > 0 ? `1 to ${totalResults}` : '0 to 0',
          },
        };
      } else {
        // Normal pagination mode - slice the already fetched results
        const paginatedResults = allResults.slice(offset, offset + pageSize);
        this.logger.log(`Returning ${paginatedResults.length} members for page ${page}`);

        // Calculate result_set string
        const startResult = totalResults > 0 ? offset + 1 : 0;
        const endResult = Math.min(offset + pageSize, totalResults);
        const resultSet = `${startResult} to ${endResult}`;

        // Transform to response DTO
        const members = paginatedResults.map((row) => ({
          auth0_id: row.auth0_id,
          member_email: row.member_email,
          passes: parseInt(row.passes, 10),
          last_visit: row.last_visit ? new Date(row.last_visit) : null,
          has_active_pass: parseInt(row.has_active_pass, 10) === 1,
        }));

        return {
          results: members,
          pagination: {
            total_results: totalResults,
            page: page,
            result_set: resultSet,
          },
        };
      }
    } catch (error) {
      this.logger.error(`Error in findAdminMembers: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin members: ${error.message}`);
    }
  }

  async findAdminMemberView(adminAuth0Id: string, memberAuth0Id: string): Promise<AdminMemberViewResponseDto> {
    try {
      this.logger.log(`Looking up admin member view with admin auth0_id: ${adminAuth0Id}, member auth0_id: ${memberAuth0Id}`);
      
      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id: adminAuth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${adminAuth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${adminAuth0Id}, role: ${adminUser.role}`);

      // Get the member user
      const memberUser = await this.userRepository.findOne({
        where: { auth0Id: memberAuth0Id },
      });

      if (!memberUser) {
        this.logger.warn(`Member user not found with auth0_id: ${memberAuth0Id}`);
        throw new NotFoundException('Member not found');
      }

      this.logger.log(`Member user found: ${memberAuth0Id}`);

      // Build query for passes with role-based filtering
      let passQueryBuilder = this.gymPassRepository
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
        .where('pass.userId = :memberAuth0Id', { memberAuth0Id });

      // Apply role-based filtering for passes
      if (adminUser.role === 'admin') {
        // Return passes for gyms matching the admin's gym_chain_id
        if (adminUser.gymChainId) {
          passQueryBuilder = passQueryBuilder.andWhere('gym.gymChainId = :gymChainId', {
            gymChainId: adminUser.gymChainId,
          });
          this.logger.log(`Filtering passes for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          // Return empty passes array
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return passes for gyms in the access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          passQueryBuilder = passQueryBuilder.andWhere('gym.id IN (:...gymIds)', {
            gymIds: adminUser.accessGyms,
          });
          this.logger.log(`Filtering passes for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          // Return empty passes array
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        // Return empty passes array
      }

      // Order by created_at descending (newest first)
      passQueryBuilder = passQueryBuilder.orderBy('pass.createdAt', 'DESC');

      const passes = await passQueryBuilder.getMany();
      this.logger.log(`Found ${passes.length} pass(es) for member ${memberAuth0Id}`);

      // Format dates helper
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

      // Format date_of_birth
      let dateOfBirth: string | null = null;
      if (memberUser.dateOfBirth) {
        try {
          if (memberUser.dateOfBirth instanceof Date) {
            dateOfBirth = memberUser.dateOfBirth.toISOString().split('T')[0];
          } else if (typeof memberUser.dateOfBirth === 'string') {
            dateOfBirth = new Date(memberUser.dateOfBirth).toISOString().split('T')[0];
          }
        } catch (dateError) {
          this.logger.warn(`Error formatting date_of_birth: ${dateError.message}`);
        }
      }

      // Transform passes to DTO
      const passesDto: PassResponseDto[] = passes.map((pass) => ({
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
      }));

      // Get created_at and updated_at from database if they exist
      // Since they're not in the entity, we'll try to get them via raw query
      let createdAt: string | null = null;
      let updatedAt: string | null = null;
      try {
        const rawUser = await this.dataSource.query(
          `SELECT created_at, updated_at FROM app_users WHERE auth0_id = $1`,
          [memberAuth0Id]
        );
        if (rawUser && rawUser.length > 0) {
          createdAt = rawUser[0].created_at ? formatDate(rawUser[0].created_at) : null;
          updatedAt = rawUser[0].updated_at ? formatDate(rawUser[0].updated_at) : null;
        }
      } catch (error) {
        this.logger.warn(`Could not fetch created_at/updated_at: ${error.message}`);
      }

      // Build response
      const response: AdminMemberViewResponseDto = {
        email: memberUser.email || '',
        full_name: memberUser.fullName || null,
        onboarding_completed: memberUser.onboardingCompleted ?? false,
        address_line1: memberUser.addressLine1 || null,
        address_line2: memberUser.addressLine2 || null,
        address_city: memberUser.addressCity || null,
        address_postcode: memberUser.addressPostcode || null,
        date_of_birth: dateOfBirth,
        created_at: createdAt,
        updated_at: updatedAt,
        emergency_contact_name: memberUser.emergencyContactName || null,
        emergency_contact_number: memberUser.emergencyContactNumber || null,
        passes: passesDto,
      };

      // Create event log
      try {
        const now = new Date();
        const adminName = adminUser.name || 'Unknown';
        const adminEmail = adminUser.email || 'Unknown';
        const memberEmail = memberUser.email || 'Unknown';
        
        const eventDescription = `User ${adminName} ${adminEmail}, viewed personal data for member ${memberEmail}`;
        
        const newEvent = this.eventRepository.create({
          userId: memberAuth0Id,
          adminUser: adminAuth0Id,
          gymId: null,
          gymChainId: adminUser.gymChainId ? adminUser.gymChainId.toString() : null,
          eventType: 'personal_data',
          eventDescription: eventDescription,
          createdAt: now,
        });
        
        await this.eventRepository.save(newEvent);
        this.logger.log(`Event record created successfully for admin member view`);
      } catch (eventError) {
        // Log error but don't fail the request if event creation fails
        this.logger.error(`Failed to create event record: ${eventError.message}`, eventError.stack);
      }

      return response;
    } catch (error) {
      this.logger.error(`Error in findAdminMemberView: ${error.message}`, error.stack);
      // Re-throw ForbiddenException and NotFoundException as-is
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin member view: ${error.message}`);
    }
  }

  async createAdminUser(adminAuth0Id: string, createUserDto: CreateAdminUserDto): Promise<{ message: string }> {
    try {
      this.logger.log(`Creating admin user with admin auth0_id: ${adminAuth0Id}`);

      // Step 1: Validate the requesting admin user
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id: adminAuth0Id },
      });

      if (!adminUser) {
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      // Step 2: Check if gym_staff can create users (they cannot)
      if (adminUser.role === 'gym_staff') {
        throw new ForbiddenException('Access denied: gym_staff cannot create users');
      }

      // Step 3: Validate that admin or gym_admin can only create for their gym_chain_id
      if (adminUser.role !== 'admin' && adminUser.role !== 'gym_admin') {
        throw new ForbiddenException('Access denied: Invalid role for user creation');
      }

      if (!adminUser.gymChainId) {
        throw new BadRequestException('Admin user must have a gym_chain_id to create users');
      }

      // Step 4: Validate access_gyms if provided
      if (createUserDto.access_gyms && createUserDto.access_gyms.length > 0) {
        // Check if gym_admin can only assign from their own access_gyms
        if (adminUser.role === 'gym_admin') {
          const invalidGyms = createUserDto.access_gyms.filter(
            (gymId) => !adminUser.accessGyms || !adminUser.accessGyms.includes(gymId)
          );
          if (invalidGyms.length > 0) {
            throw new BadRequestException(
              `Access denied: You can only assign gyms from your own access_gyms. Invalid gym IDs: ${invalidGyms.join(', ')}`
            );
          }
        }

        // Validate that all access_gyms belong to the gym_chain_id
        const gyms = await this.gymRepository
          .createQueryBuilder('gym')
          .where('gym.id IN (:...gymIds)', { gymIds: createUserDto.access_gyms })
          .getMany();

        // Check if all requested gym IDs were found
        const foundGymIds = gyms.map((gym) => gym.id);
        const notFoundGyms = createUserDto.access_gyms.filter((gymId) => !foundGymIds.includes(gymId));
        if (notFoundGyms.length > 0) {
          throw new BadRequestException(`Invalid gym IDs: ${notFoundGyms.join(', ')}`);
        }

        // Check that all gyms belong to the gym_chain_id
        const gymsNotInChain = gyms.filter((gym) => gym.gymChainId !== adminUser.gymChainId);
        if (gymsNotInChain.length > 0) {
          throw new BadRequestException(
            `Some gyms do not belong to your gym_chain_id: ${gymsNotInChain.map((g) => g.id).join(', ')}`
          );
        }
      }

      // Step 5: Create user in Auth0 (role assignment removed as assign:roles scope not available)
      let auth0UserId: string;
      try {
        const auth0User = await this.auth0Service.createUser(
          createUserDto.email,
          createUserDto.name,
          createUserDto.password
        );
        auth0UserId = auth0User.user_id;
        this.logger.log(`Auth0 user created successfully with ID: ${auth0UserId} (role will be managed separately)`);
      } catch (auth0Error: any) {
        this.logger.error(`Failed to create Auth0 user: ${auth0Error.message}`, auth0Error.stack);
        throw new BadRequestException(`Failed to create user in Auth0: ${auth0Error.message}`);
      }

      // Step 6: Check if admin_user already exists (shouldn't happen, but safety check)
      const existingAdminUser = await this.adminUserRepository.findOne({
        where: { auth0Id: auth0UserId },
      });

      if (existingAdminUser) {
        // If Auth0 user was created but admin_user already exists, we might need to clean up
        this.logger.warn(`Admin user already exists for auth0_id: ${auth0UserId}`);
        throw new BadRequestException('User already exists in admin_users table');
      }

      // Step 7: Create admin_user record
      const now = new Date();
      const newAdminUser = this.adminUserRepository.create({
        auth0Id: auth0UserId,
        email: createUserDto.email,
        name: createUserDto.name,
        gymChainId: adminUser.gymChainId,
        role: createUserDto.role,
        permission: createUserDto.permission,
        accessGyms: createUserDto.access_gyms && createUserDto.access_gyms.length > 0 ? createUserDto.access_gyms : null,
      });

      await this.adminUserRepository.save(newAdminUser);
      this.logger.log(`Admin user created successfully in database with auth0_id: ${auth0UserId}`);

      // Step 8: Update date_created and date_updated if they exist in the database
      try {
        await this.dataSource.query(
          `UPDATE admin_users SET date_created = $1, date_updated = $1 WHERE auth0_id = $2`,
          [now, auth0UserId]
        );
      } catch (error) {
        // If columns don't exist, that's okay - just log it
        this.logger.warn(`Could not update date_created/date_updated: ${error.message}`);
      }

      // Step 9: Create event log
      try {
        const initiatorEmail = adminUser.email || 'Unknown';
        const createdUserEmail = createUserDto.email || 'Unknown';
        const eventDescription = `User ${initiatorEmail} created user ${createdUserEmail}`;
        
        const newEvent = this.eventRepository.create({
          userId: null,
          adminUser: adminAuth0Id,
          gymId: null,
          gymChainId: adminUser.gymChainId ? adminUser.gymChainId.toString() : null,
          eventType: 'new_user',
          eventDescription: eventDescription,
          createdAt: now,
        });
        
        await this.eventRepository.save(newEvent);
        this.logger.log(`Event record created successfully for new admin user creation`);
      } catch (eventError) {
        // Log error but don't fail the request if event creation fails
        this.logger.error(`Failed to create event record: ${eventError.message}`, eventError.stack);
      }

      return {
        message: 'Admin user created successfully',
      };
    } catch (error) {
      this.logger.error(`Error in createAdminUser: ${error.message}`, error.stack);
      // Re-throw known exceptions as-is
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new BadRequestException(`Failed to create admin user: ${error.message}`);
    }
  }

  async findAdminUserList(auth0Id: string): Promise<AdminUserListItemDto[]> {
    try {
      this.logger.log(`Looking up admin user list with auth0_id: ${auth0Id}`);
      
      // First, find the admin user to get their role and gym_chain_id or subordinates
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      let queryBuilder = this.adminUserRepository.createQueryBuilder('adminUser');

      // Apply role-based filtering
      if (adminUser.role === 'admin') {
        // Return all admin_users associated to the user's gym_chain_id
        if (adminUser.gymChainId) {
          queryBuilder = queryBuilder.where('adminUser.gymChainId = :gymChainId', {
            gymChainId: adminUser.gymChainId,
          });
          this.logger.log(`Filtering admin users for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          return [];
        }
      } else if (adminUser.role === 'gym_admin') {
        // Return all admin_users in the user's subordinates array
        // First, try to get subordinates from the database
        let subordinates: string[] = [];
        
        try {
          // Check if subordinates column exists and get it
          const rawUser = await this.dataSource.query(
            `SELECT subordinates FROM admin_users WHERE auth0_id = $1`,
            [auth0Id]
          );
          
          if (rawUser && rawUser.length > 0 && rawUser[0].subordinates) {
            // Handle subordinates - could be JSONB array, JSON string, or comma-separated string
            const subordinatesData = rawUser[0].subordinates;
            if (Array.isArray(subordinatesData)) {
              subordinates = subordinatesData;
            } else if (typeof subordinatesData === 'string') {
              try {
                // Try parsing as JSON first
                const parsed = JSON.parse(subordinatesData);
                subordinates = Array.isArray(parsed) ? parsed : [subordinatesData];
              } catch {
                // If not JSON, treat as comma-separated string
                subordinates = subordinatesData.split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Could not fetch subordinates: ${error.message}`);
        }

        if (subordinates && subordinates.length > 0) {
          queryBuilder = queryBuilder.where('adminUser.auth0Id IN (:...subordinateIds)', {
            subordinateIds: subordinates,
          });
          this.logger.log(`Filtering admin users for gym_admin with subordinates: ${subordinates}`);
        } else {
          this.logger.warn(`Gym admin user has no subordinates`);
          return [];
        }
      } else {
        this.logger.warn(`Invalid role for user list: ${adminUser.role}`);
        throw new ForbiddenException('Access denied: Invalid role for user list');
      }

      // Select fields
      queryBuilder = queryBuilder.select([
        'adminUser.auth0Id',
        'adminUser.name',
        'adminUser.email',
        'adminUser.role',
        'adminUser.permission',
      ]);

      // Execute query
      const adminUsers = await queryBuilder.getMany();
      this.logger.log(`Found ${adminUsers.length} admin user(s)`);

      // Transform to response DTO
      const results = adminUsers.map((user) => ({
        auth0_id: user.auth0Id,
        name: user.name || null,
        email: user.email || null,
        role: user.role || null,
        permission: user.permission || null,
      }));

      return results;
    } catch (error) {
      this.logger.error(`Error in findAdminUserList: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      // For other errors, wrap in a more descriptive error
      throw new Error(`Failed to fetch admin user list: ${error.message}`);
    }
  }

  async testAuth0Connection(): Promise<{ success: boolean; message: string; details?: any }> {
    return await this.auth0Service.testConnection();
  }

  async findAdminLocations(auth0Id: string): Promise<AdminLocationResponseDto[]> {
    try {
      this.logger.log(`Looking up admin user locations with auth0_id: ${auth0Id}`);
      
      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      let queryBuilder = this.gymRepository
        .createQueryBuilder('gym')
        .select([
          'gym.id',
          'gym.name',
          'gym.gymChainId',
          'gym.address',
          'gym.postcode',
          'gym.city',
        ]);

      // Based on role, apply different filters
      if (adminUser.role === 'admin') {
        // Return all gyms where gym_chain_id matches the admin user's gym_chain_id
        if (adminUser.gymChainId) {
          queryBuilder = queryBuilder.where('gym.gymChainId = :gymChainId', { 
            gymChainId: adminUser.gymChainId 
          });
          this.logger.log(`Filtering locations for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          return [];
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return all gyms where id exists in the user's access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          queryBuilder = queryBuilder.where('gym.id IN (:...gymIds)', { 
            gymIds: adminUser.accessGyms 
          });
          this.logger.log(`Filtering locations for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          return [];
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        return [];
      }

      const gyms = await queryBuilder.getMany();
      this.logger.log(`Found ${gyms.length} locations for admin user ${auth0Id}`);

      // Map to response DTO
      return gyms.map((gym) => ({
        id: gym.id,
        name: gym.name,
        gym_chain_id: gym.gymChainId,
        address: gym.address,
        postcode: gym.postcode,
        city: gym.city,
      }));
    } catch (error) {
      this.logger.error(`Error in findAdminLocations: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`Failed to fetch admin locations: ${error.message}`);
    }
  }

  async findAdminPasses(auth0Id: string, page: number = 1, search?: string): Promise<AdminPassesPaginatedResponseDto> {
    try {
      this.logger.log(`Looking up admin passes with auth0_id: ${auth0Id}, page: ${page}, search: ${search || 'none'}`);
      
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      const isSearchMode = !!search;

      // First, find the admin user to get their role and gym_chain_id or access_gyms
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${auth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      this.logger.log(`Admin user found: ${auth0Id}, role: ${adminUser.role}`);

      // Build query for passes with join to gyms for filtering
      let queryBuilder = this.gymPassRepository
        .createQueryBuilder('pass')
        .innerJoin('pass.gym', 'gym')
        .leftJoin('pass.user', 'user')
        .select([
          'pass.id',
          'pass.userId',
          'pass.gymId',
          'pass.passCode',
          'pass.status',
          'pass.validUntil',
          'pass.usedAt',
          'pass.qrcodeUrl',
          'pass.createdAt',
          'pass.updatedAt',
          'pass.subscriptionTier',
        ]);

      // Based on role, apply different filters
      if (adminUser.role === 'admin') {
        // Return all passes where the pass's gym_id is associated with the same gym_chain_id
        if (adminUser.gymChainId) {
          queryBuilder = queryBuilder.where('gym.gymChainId = :gymChainId', { 
            gymChainId: adminUser.gymChainId 
          });
          this.logger.log(`Filtering passes for admin with gym_chain_id: ${adminUser.gymChainId}`);
        } else {
          this.logger.warn(`Admin user has no gym_chain_id`);
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else if (adminUser.role === 'gym_admin' || adminUser.role === 'gym_staff') {
        // Return all passes where the pass's gym_id is in the user's access_gyms array
        if (adminUser.accessGyms && adminUser.accessGyms.length > 0) {
          queryBuilder = queryBuilder.where('pass.gymId IN (:...gymIds)', { 
            gymIds: adminUser.accessGyms 
          });
          this.logger.log(`Filtering passes for ${adminUser.role} with access_gyms: ${adminUser.accessGyms}`);
        } else {
          this.logger.warn(`${adminUser.role} user has no access_gyms`);
          return {
            results: [],
            pagination: {
              total_results: 0,
              page: isSearchMode ? 1 : page,
              result_set: '0 to 0',
            },
          };
        }
      } else {
        this.logger.warn(`Unknown role: ${adminUser.role}`);
        return {
          results: [],
          pagination: {
            total_results: 0,
            page: isSearchMode ? 1 : page,
            result_set: '0 to 0',
          },
        };
      }

      // Apply search filter if search parameter is provided
      if (isSearchMode) {
        // Prepend "PASS-" to search term if it doesn't already start with it
        let searchTerm = search.trim();
        if (!searchTerm.toUpperCase().startsWith('PASS-')) {
          searchTerm = `PASS-${searchTerm}`;
        }
        const searchPattern = `%${searchTerm}%`;
        queryBuilder = queryBuilder.andWhere(
          '(pass.passCode ILIKE :search OR user.email ILIKE :search)',
          { search: searchPattern }
        );
        this.logger.log(`Applying search filter: ${searchTerm} (original: ${search})`);
      }

      // Order by created_at descending (newest first)
      queryBuilder = queryBuilder.orderBy('pass.createdAt', 'DESC');

      // Get total count before pagination
      const totalResults = await queryBuilder.getCount();
      this.logger.log(`Total passes found: ${totalResults}`);

      // Apply pagination only if not in search mode
      if (isSearchMode) {
        // In search mode, return all results without pagination
        const passes = await queryBuilder.getMany();
        this.logger.log(`Returning ${passes.length} passes from search (no pagination)`);

        // Map to response DTO
        const results = passes.map((pass) => ({
          id: pass.id,
          user_id: pass.userId,
          gym_id: pass.gymId,
          pass_code: pass.passCode,
          status: pass.status,
          valid_until: pass.validUntil,
          used_at: pass.usedAt,
          qr_code_url: pass.qrcodeUrl,
          created_at: pass.createdAt,
          updated_at: pass.updatedAt,
          subscription_tier: pass.subscriptionTier,
        }));

        return {
          results,
          pagination: {
            total_results: totalResults,
            page: 1,
            result_set: totalResults > 0 ? `1 to ${totalResults}` : '0 to 0',
          },
        };
      } else {
        // Normal pagination mode
        const passes = await queryBuilder
          .skip(offset)
          .take(pageSize)
          .getMany();

        this.logger.log(`Returning ${passes.length} passes for page ${page}`);

        // Calculate result_set string
        const startResult = totalResults > 0 ? offset + 1 : 0;
        const endResult = Math.min(offset + pageSize, totalResults);
        const resultSet = `${startResult} to ${endResult}`;

        // Map to response DTO
        const results = passes.map((pass) => ({
          id: pass.id,
          user_id: pass.userId,
          gym_id: pass.gymId,
          pass_code: pass.passCode,
          status: pass.status,
          valid_until: pass.validUntil,
          used_at: pass.usedAt,
          qr_code_url: pass.qrcodeUrl,
          created_at: pass.createdAt,
          updated_at: pass.updatedAt,
          subscription_tier: pass.subscriptionTier,
        }));

        return {
          results,
          pagination: {
            total_results: totalResults,
            page: page,
            result_set: resultSet,
          },
        };
      }
    } catch (error) {
      this.logger.error(`Error in findAdminPasses: ${error.message}`, error.stack);
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`Failed to fetch admin passes: ${error.message}`);
    }
  }

  async checkInPass(adminAuth0Id: string, passCode: string): Promise<AdminCheckInResponseDto> {
    try {
      // Prepend "PASS-" to pass code if it doesn't already start with it
      let normalizedPassCode = passCode.trim();
      if (!normalizedPassCode.toUpperCase().startsWith('PASS-')) {
        normalizedPassCode = `PASS-${normalizedPassCode}`;
      }
      
      this.logger.log(`Checking in pass with admin auth0_id: ${adminAuth0Id}, pass_code: ${normalizedPassCode} (original: ${passCode})`);
      
      // Step 1: Find the admin user
      const adminUser = await this.adminUserRepository.findOne({
        where: { auth0Id: adminAuth0Id },
      });

      if (!adminUser) {
        this.logger.warn(`Admin user not found with auth0_id: ${adminAuth0Id}`);
        throw new ForbiddenException('Access denied: Admin privileges required');
      }

      if (!adminUser.gymChainId) {
        throw new BadRequestException('Admin user must be associated with a gym chain');
      }

      this.logger.log(`Admin user found: ${adminAuth0Id}, gym_chain_id: ${adminUser.gymChainId}`);

      // Step 2: Find the pass by pass_code with gym and gym_chain information
      const pass = await this.gymPassRepository
        .createQueryBuilder('pass')
        .innerJoinAndSelect('pass.gym', 'gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
        .where('pass.passCode = :passCode', { passCode: normalizedPassCode })
        .getOne();

      if (!pass) {
        throw new NotFoundException('Pass not found');
      }

      const passGymChainId = pass.gym?.gymChainId;
      const gymChainName = pass.gym?.gymChain?.name || 'Unknown Gym Chain';

      this.logger.log(`Pass found: ${pass.id}, gym_id: ${pass.gymId}, gym_chain_id: ${passGymChainId}`);

      // Step 3: Validate that the pass's gym belongs to the admin user's gym_chain_id
      if (!passGymChainId || passGymChainId !== adminUser.gymChainId) {
        this.logger.warn(`Pass ${normalizedPassCode} does not belong to admin's gym chain. Pass gym_chain_id: ${passGymChainId}, Admin gym_chain_id: ${adminUser.gymChainId}`);
        throw new BadRequestException(`This pass is not allowed for ${gymChainName}`);
      }

      // Step 4: Return pass data
      return {
        id: pass.id,
        user_id: pass.userId,
        gym_id: pass.gymId,
        pass_code: pass.passCode,
        status: pass.status,
        valid_until: pass.validUntil,
        used_at: pass.usedAt,
        qr_code_url: pass.qrcodeUrl,
        created_at: pass.createdAt,
        updated_at: pass.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error in checkInPass: ${error.message}`, error.stack);
      // Re-throw known exceptions as-is
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new Error(`Failed to check in pass: ${error.message}`);
    }
  }
}

