import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gym } from './entities/gym.entity';
import { GetGymsDto } from './dto/get-gyms.dto';
import { GymDetailResponseDto } from './dto/gym-detail-response.dto';

@Injectable()
export class GymsService {
  private readonly logger = new Logger(GymsService.name);

  constructor(
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
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

      // Transform the data to match the required format
      return gyms.map((gym) => ({
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
      }));
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
      }

      return {
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
        rating: gym.rating ? parseFloat(gym.rating.toString()) : null,
        created_at: formatDate(gym.createdAt),
        updated_at: formatDate(gym.updatedAt),
        status: gym.status,
        gym_chain: gymChain,
      };
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch gym: ${error.message}`);
    }
  }
}

