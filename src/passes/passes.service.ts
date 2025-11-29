import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymPass } from './entities/gym-pass.entity';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';
import { GeneratePassDto } from './dto/generate-pass.dto';
import { PassesWithSubscriptionResponseDto, SubscriptionSummaryDto } from './dto/passes-with-subscription-response.dto';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPricing } from './entities/pass-pricing.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
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
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private subscriptionsService: SubscriptionsService,
    private usersService: UsersService,
    private sendGridService: SendGridService,
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

      return passes.map((pass) => {
        const response = {
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
      });
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

      // Step 1.5: Check if user has credits available (visits_used < monthly_limit)
      if (subscription.visits_used >= subscription.monthly_limit) {
        throw new BadRequestException(
          `You are out of passes for this month. You have used ${subscription.visits_used} of ${subscription.monthly_limit} available passes.`,
        );
      }

      // Step 1.6: Check if user already has an active pass (valid_until > current date/time)
      const now = new Date();
      const existingActivePass = await this.gymPassRepository
        .createQueryBuilder('pass')
        .where('pass.userId = :auth0Id', { auth0Id })
        .andWhere('pass.validUntil IS NOT NULL')
        .andWhere('pass.validUntil > :now', { now })
        .orderBy('pass.createdAt', 'DESC')
        .getOne();

      if (existingActivePass) {
        throw new BadRequestException(
          'Only one active pass at a time. You must use or cancel your current active pass before generating a new one.',
        );
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

      // Step 6.5: Increment visits_used in the subscription
      // Fetch the subscription entity to update it
      const subscriptionEntity = await this.subscriptionRepository.findOne({
        where: { userId: auth0Id, status: 'active' },
      });

      if (subscriptionEntity) {
        subscriptionEntity.visitsUsed += 1;
        await this.subscriptionRepository.save(subscriptionEntity);
        this.logger.log(
          `Incremented visits_used for subscription ${subscriptionEntity.id}. New value: ${subscriptionEntity.visitsUsed}`,
        );
      } else {
        this.logger.error(
          `Could not find subscription entity to update visits_used for user: ${auth0Id}`,
        );
        // Don't throw error - pass was already created, just log the issue
      }

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

  async findPassesWithSubscription(auth0Id: string): Promise<PassesWithSubscriptionResponseDto> {
    try {
      this.logger.log(`Looking up passes with subscription for auth0_id: ${auth0Id}`);

      // Fetch all passes for the user
      const allPasses = await this.findByAuth0Id(auth0Id);

      // Get current date/time for comparison
      const now = new Date();

      // Separate passes into active and history based on valid_until date
      // Active: valid_until > current date/time
      // Expired: valid_until <= current date/time or valid_until is null
      const activePasses = allPasses.filter(pass => {
        if (!pass.valid_until) return false;
        const validUntilDate = new Date(pass.valid_until);
        return validUntilDate > now;
      });
      const passHistory = allPasses.filter(pass => {
        if (!pass.valid_until) return true; // Consider passes without valid_until as expired
        const validUntilDate = new Date(pass.valid_until);
        return validUntilDate <= now;
      });

      // Fetch active subscription
      let subscriptionSummary: SubscriptionSummaryDto | null = null;
      try {
        const subscription = await this.subscriptionsService.findByAuth0Id(auth0Id, { status: 'active' });
        
        subscriptionSummary = {
          tier: subscription.tier,
          monthly_limit: subscription.monthly_limit,
          visits_used: subscription.visits_used,
          price: subscription.price,
          next_billing_date: subscription.next_billing_date,
          guest_passes_limit: subscription.guest_passes_limit,
          guest_passes_used: subscription.guest_passes_used,
          current_period_start: subscription.current_period_start || null,
          current_period_end: subscription.current_period_end || null,
        };
      } catch (error) {
        if (error instanceof NotFoundException) {
          this.logger.log(`No active subscription found for user: ${auth0Id}`);
          // subscriptionSummary remains null
        } else {
          this.logger.error(
            `Error fetching subscription for user ${auth0Id}: ${error.message}`,
            error.stack,
          );
          // Continue without subscription data
        }
      }

      return {
        subscription: subscriptionSummary,
        active_passes: activePasses,
        pass_history: passHistory,
      };
    } catch (error) {
      this.logger.error(
        `Error in findPassesWithSubscription: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch passes with subscription: ${error.message}`);
    }
  }
}

