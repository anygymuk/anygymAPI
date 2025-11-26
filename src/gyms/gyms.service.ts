import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gym } from './entities/gym.entity';
import { GetGymsDto } from './dto/get-gyms.dto';

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
}

