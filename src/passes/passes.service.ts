import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymPass } from './entities/gym-pass.entity';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';

@Injectable()
export class PassesService {
  private readonly logger = new Logger(PassesService.name);

  constructor(
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
  ) {}

  async findByAuth0Id(auth0Id: string, filters?: GetPassesDto): Promise<PassResponseDto[]> {
    try {
      this.logger.log(`Looking up passes for auth0_id: ${auth0Id}${filters?.status ? ` with status: ${filters.status}` : ''}`);

      // Build query with joins to gyms and gym_chains
      const queryBuilder = this.gymPassRepository
        .createQueryBuilder('pass')
        .leftJoinAndSelect('pass.gym', 'gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
        .select([
          'pass.id',
          'pass.userId',
          'pass.gymId',
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
        .where('pass.userId = :auth0Id', { auth0Id });

      // Filter by status if provided
      if (filters?.status) {
        queryBuilder.andWhere('pass.status = :status', { status: filters.status });
      }

      // Order by created_at descending (newest first)
      queryBuilder.orderBy('pass.createdAt', 'DESC');

      const passes = await queryBuilder.getMany();

      this.logger.log(`Found ${passes.length} pass(es) for user: ${auth0Id}`);

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

      return passes.map((pass) => ({
        id: pass.id,
        user_id: pass.userId,
        gym_id: pass.gymId,
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
    } catch (error) {
      this.logger.error(
        `Error in findByAuth0Id: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch passes: ${error.message}`);
    }
  }
}

