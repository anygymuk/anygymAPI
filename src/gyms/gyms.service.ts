import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gym } from './entities/gym.entity';
import { Rating } from './entities/rating.entity';
import { User } from '../users/entities/user.entity';
import { GetGymsDto } from './dto/get-gyms.dto';
import { GymDetailResponseDto } from './dto/gym-detail-response.dto';
import { SetRatingDto } from './dto/set-rating.dto';

@Injectable()
export class GymsService {
  private readonly logger = new Logger(GymsService.name);

  /**
   * Removes null, undefined, and empty string values from an object
   */
  private removeEmptyValues<T>(obj: T): Partial<T> {
    const result: any = {};
    for (const key in obj) {
      const value = obj[key];
      // Keep the value if it's not null, undefined, or empty string
      // Also keep arrays (even if empty) and objects
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          // Keep arrays even if empty
          result[key] = value;
        } else if (typeof value === 'object') {
          // Recursively clean nested objects
          const cleaned = this.removeEmptyValues(value);
          // Only include if the cleaned object has properties
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

  constructor(
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(filters: GetGymsDto) {
    try {
      const queryBuilder = this.gymRepository
        .createQueryBuilder('gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
        .where('gym.status = :status', { status: 'active' });

      // Filter by required_tier - use the actual database column name
      if (filters.required_tier) {
        queryBuilder.andWhere('gym.requiredTier = :requiredTier', {
          requiredTier: filters.required_tier,
        });
      }

      // Filter by gym_chain_id - use the entity property name
      if (filters.gym_chain_id) {
        queryBuilder.andWhere('gym.gymChainId = :gymChainId', {
          gymChainId: filters.gym_chain_id,
        });
      }

      // Filter by amenities (if amenities is provided, check if it's included in the amenities array)
      if (filters.amenities) {
        // Handle both single amenity string and comma-separated list
        const amenityList = filters.amenities.split(',').map(a => a.trim());
        // For JSONB containment, we need to use the proper syntax
        // Check if any of the amenities in the list are contained in the gym's amenities
        if (amenityList.length === 1) {
          queryBuilder.andWhere('gym.amenities @> :amenities::jsonb', {
            amenities: JSON.stringify([amenityList[0]]),
          });
        } else {
          // For multiple amenities, check if all are present
          queryBuilder.andWhere('gym.amenities @> :amenities::jsonb', {
            amenities: JSON.stringify(amenityList),
          });
        }
      }

      const gyms = await queryBuilder.getMany();
      this.logger.log(`Found ${gyms.length} active gyms`);

      // Get all gym IDs to fetch ratings in batch
      const gymIds = gyms.map((gym) => gym.id);

      // Calculate average rating and count for all gyms in one query
      let ratingStats: any[] = [];
      if (gymIds.length > 0) {
        ratingStats = await this.ratingRepository
          .createQueryBuilder('rating')
          .select('rating.gymId', 'gymId')
          .addSelect('AVG(rating.rating)', 'averageRating')
          .addSelect('COUNT(rating.id)', 'ratingCount')
          .where('rating.gymId IN (:...gymIds)', { gymIds })
          .groupBy('rating.gymId')
          .getRawMany();
      }

      // Create a map for quick lookup
      const ratingMap = new Map<number, { averageRating: number | null; ratingCount: number }>();
      ratingStats.forEach((stat) => {
        const avgRating = stat.averageRating != null ? parseFloat(stat.averageRating) : null;
        ratingMap.set(stat.gymId, {
          averageRating: avgRating,
          ratingCount: parseInt(stat.ratingCount, 10) || 0,
        });
      });

      // Transform the data to match the required format
      return gyms.map((gym) => {
        const ratingData = ratingMap.get(gym.id);
        
        const response: any = {
          id: gym.id,
          name: gym.name,
          gym_chain_id: gym.gymChainId,
          gym_chain_name: gym.gymChain?.name || null,
          gym_chain_logo: gym.gymChain?.logo || null,
          address: gym.address,
          postcode: gym.postcode,
          city: gym.city,
          latitude: gym.latitude ? parseFloat(gym.latitude.toString()) : null,
          longitude: gym.longitude ? parseFloat(gym.longitude.toString()) : null,
          required_tier: gym.requiredTier,
          amenities: gym.amenities || [],
          opening_hours: gym.openingHours || null,
          phone: gym.phone || null,
          image_url: gym.imageUrl || null,
        };

        // Only include rating and rating_count if the gym has ratings
        if (ratingData && ratingData.ratingCount > 0) {
          response.rating = Math.round((ratingData.averageRating || 0) * 10) / 10;
          response.rating_count = ratingData.ratingCount;
        }

        return this.removeEmptyValues(response);
      });
    } catch (error) {
      this.logger.error('Error fetching gyms:', error);
      throw error;
    }
  }

  async findOne(id: number): Promise<GymDetailResponseDto> {
    try {
      this.logger.log(`Looking up gym with id: ${id}`);

      const gym = await this.gymRepository
        .createQueryBuilder('gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
        .where('gym.id = :id', { id })
        .getOne();

      if (!gym) {
        this.logger.warn(`Gym not found with id: ${id}`);
        throw new NotFoundException('Gym not found');
      }

      this.logger.log(`Gym found: ${gym.name}`);

      // Get rating statistics from ratings table
      const ratingStats = await this.ratingRepository
        .createQueryBuilder('rating')
        .select('AVG(rating.rating)', 'averageRating')
        .addSelect('COUNT(rating.id)', 'ratingCount')
        .where('rating.gymId = :gymId', { gymId: id })
        .getRawOne();

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

      // Build gym_chain object with conditional fields
      let gymChain: GymDetailResponseDto['gym_chain'] = null;
      if (gym.gymChain) {
        gymChain = {
          id: gym.gymChain.id,
          name: gym.gymChain.name,
          logo_url: gym.gymChain.logo || null,
          brand_color: gym.gymChain.brandColor || null,
          website: gym.gymChain.website || null,
          description: gym.gymChain.description || null,
        };

        // Conditionally include terms/health_statement or their URLs
        if (!gym.gymChain.useTermsUrl) {
          gymChain.terms = gym.gymChain.terms || null;
        } else {
          gymChain.terms_url = gym.gymChain.termsUrl || null;
        }

        if (!gym.gymChain.useHealthStatementUrl) {
          gymChain.health_statement = gym.gymChain.healthStatement || null;
        } else {
          gymChain.health_statement_url = gym.gymChain.healthStatementUrl || null;
        }

        // Remove empty values from gym_chain
        gymChain = this.removeEmptyValues(gymChain) as GymDetailResponseDto['gym_chain'];
      }

      const response: any = {
        id: gym.id,
        name: gym.name,
        address: gym.address,
        postcode: gym.postcode,
        city: gym.city,
        latitude: gym.latitude ? parseFloat(gym.latitude.toString()) : 0,
        longitude: gym.longitude ? parseFloat(gym.longitude.toString()) : 0,
        required_tier: gym.requiredTier,
        amenities: gym.amenities || [],
        opening_hours: gym.openingHours || null,
        phone: gym.phone || null,
        image_url: gym.imageUrl || null,
        created_at: formatDate(gym.createdAt),
        updated_at: formatDate(gym.updatedAt),
        status: gym.status,
        gym_chain: gymChain,
      };

      // Only include rating and rating_count if the gym has ratings
      const ratingCount = ratingStats ? parseInt(ratingStats.ratingCount, 10) || 0 : 0;
      if (ratingCount > 0 && ratingStats.averageRating != null) {
        const avgRating = parseFloat(ratingStats.averageRating);
        response.rating = Math.round(avgRating * 10) / 10;
        response.rating_count = ratingCount;
      }

      return this.removeEmptyValues(response) as GymDetailResponseDto;
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch gym: ${error.message}`);
    }
  }

  async setRating(setRatingDto: SetRatingDto): Promise<{ message: string }> {
    try {
      this.logger.log(
        `Setting rating for user_id: ${setRatingDto.user_id}, gym_id: ${setRatingDto.gym_id}, rating: ${setRatingDto.rating}`,
      );

      // Validate user exists
      const user = await this.userRepository.findOne({
        where: { auth0Id: setRatingDto.user_id },
      });

      if (!user) {
        this.logger.warn(`User not found with auth0_id: ${setRatingDto.user_id}`);
        throw new NotFoundException(`User with auth0_id '${setRatingDto.user_id}' not found`);
      }

      // Validate gym exists
      const gym = await this.gymRepository.findOne({
        where: { id: setRatingDto.gym_id },
      });

      if (!gym) {
        this.logger.warn(`Gym not found with id: ${setRatingDto.gym_id}`);
        throw new NotFoundException(`Gym with id '${setRatingDto.gym_id}' not found`);
      }

      // Check if user already has a rating for this gym
      const existingRating = await this.ratingRepository.findOne({
        where: {
          userId: setRatingDto.user_id,
          gymId: setRatingDto.gym_id,
        },
      });

      if (existingRating) {
        this.logger.warn(
          `User ${setRatingDto.user_id} already has a rating for gym ${setRatingDto.gym_id}`,
        );
        throw new ConflictException(
          `User has already provided a rating for the specified gym`,
        );
      }

      // Create new rating
      const newRating = this.ratingRepository.create({
        userId: setRatingDto.user_id,
        gymId: setRatingDto.gym_id,
        rating: setRatingDto.rating,
        createdAt: new Date(),
      });

      await this.ratingRepository.save(newRating);
      this.logger.log(
        `Successfully created rating with id: ${newRating.id} for user ${setRatingDto.user_id} and gym ${setRatingDto.gym_id}`,
      );

      return {
        message: 'Rating created successfully',
      };
    } catch (error) {
      this.logger.error(`Error in setRating: ${error.message}`, error.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new Error(`Failed to set rating: ${error.message}`);
    }
  }
}

