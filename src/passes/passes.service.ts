import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymPass } from './entities/gym-pass.entity';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';
import { GeneratePassDto } from './dto/generate-pass.dto';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPricing } from './entities/pass-pricing.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { SendGridService } from './services/sendgrid.service';

@Injectable()
export class PassesService {
  private readonly logger = new Logger(PassesService.name);

  constructor(
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
    @InjectRepository(PassPricing)
    private passPricingRepository: Repository<PassPricing>,
    private subscriptionsService: SubscriptionsService,
    private usersService: UsersService,
    private sendGridService: SendGridService,
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

  /**
   * Validates if subscription tier allows access to gym tier
   * standard < premium < elite
   */
  private validateTierAccess(subscriptionTier: string, gymRequiredTier: string): boolean {
    const tierLevels: { [key: string]: number } = {
      standard: 1,
      premium: 2,
      elite: 3,
    };

    const subscriptionLevel = tierLevels[subscriptionTier.toLowerCase()] || 0;
    const gymLevel = tierLevels[gymRequiredTier.toLowerCase()] || 999;

    return subscriptionLevel >= gymLevel;
  }

  async generatePass(auth0Id: string, generatePassDto: GeneratePassDto): Promise<{ message: string; pass_id: number }> {
    try {
      this.logger.log(`Generating pass for auth0_id: ${auth0Id}, gym_id: ${generatePassDto.gym_id}`);

      // Security check: Ensure the auth0_id in the request matches the header
      if (generatePassDto.auth0_id !== auth0Id) {
        throw new ForbiddenException('Access denied: You can only generate passes for yourself');
      }

      // Step 1: Validate user has an active subscription
      let subscription;
      try {
        subscription = await this.subscriptionsService.findByAuth0Id(auth0Id, { status: 'active' });
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException('You must have an active subscription to generate a pass');
        }
        throw error;
      }

      // Step 2: Get gym details
      const gym = await this.gymRepository.findOne({
        where: { id: generatePassDto.gym_id },
      });

      if (!gym) {
        throw new NotFoundException('Gym not found');
      }

      if (gym.status !== 'active') {
        throw new BadRequestException('This gym is not currently active');
      }

      // Step 3: Validate subscription tier matches gym required tier
      if (!this.validateTierAccess(subscription.tier, gym.requiredTier)) {
        throw new ForbiddenException(
          `Your ${subscription.tier} subscription does not allow access to ${gym.requiredTier} tier gyms. ` +
          `Standard subscriptions can access standard gyms, premium can access standard and premium, ` +
          `and elite can access all gym tiers.`
        );
      }

      // Step 4: Get pass pricing
      const passPricing = await this.passPricingRepository.findOne({
        where: { tier: subscription.tier },
      });

      if (!passPricing) {
        this.logger.warn(`Pass pricing not found for tier: ${subscription.tier}, using 0 as default`);
      }

      // Step 5: Generate pass code
      const passCode = `PASS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Step 6: Create pass record
      const now = new Date();
      const validUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(passCode)}`;

      const newPass = this.gymPassRepository.create({
        userId: auth0Id,
        gymId: generatePassDto.gym_id,
        passCode,
        status: 'active',
        validUntil,
        qrcodeUrl: qrCodeUrl,
        createdAt: now,
        updatedAt: now,
        subscriptionTier: subscription.tier,
        passCost: passPricing ? parseFloat(passPricing.defaultPrice.toString()) : 0,
      });

      const savedPass = await this.gymPassRepository.save(newPass);
      this.logger.log(`Pass created successfully with ID: ${savedPass.id}`);

      // Step 7: Get user details for email
      const user = await this.usersService.findOneByAuth0Id(auth0Id);

      // Step 8: Send email via SendGrid (don't await - fire and forget)
      this.sendGridService.sendPassEmail({
        to: user.email,
        recipientName: user.full_name || 'Valued Member',
        gymName: gym.name,
        passQr: qrCodeUrl,
        passCode,
        gymAddress: gym.address,
        gymPostcode: gym.postcode,
        gymCity: gym.city,
        gymLng: parseFloat(gym.longitude.toString()),
        gymLat: parseFloat(gym.latitude.toString()),
      }).catch((emailError) => {
        // Log email error but don't fail the request
        this.logger.error(`Failed to send pass email: ${emailError.message}`, emailError.stack);
      });

      return {
        message: 'Pass generated successfully',
        pass_id: savedPass.id,
      };
    } catch (error) {
      this.logger.error(`Error in generatePass: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to generate pass: ${error.message}`);
    }
  }
}

