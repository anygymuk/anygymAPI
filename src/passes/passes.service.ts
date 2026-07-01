import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityManager } from 'typeorm';
import Stripe from 'stripe';
import { GymPass } from './entities/gym-pass.entity';
import { PassPurchase } from './entities/pass-purchase.entity';
import { PassResponseDto } from './dto/pass-response.dto';
import { GetPassesDto } from './dto/get-passes.dto';
import { GeneratePassDto } from './dto/generate-pass.dto';
import { PurchasePassCheckoutDto } from './dto/purchase-pass-checkout.dto';
import { PurchasePassCheckoutResponseDto } from './dto/purchase-pass-checkout-response.dto';
import {
  PassesWithSubscriptionResponseDto,
  RecentGymDto,
  SubscriptionSummaryDto,
} from './dto/passes-with-subscription-response.dto';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPricing } from './entities/pass-pricing.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Event } from '../users/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import { SendGridService } from './services/sendgrid.service';

export interface CreateGymPassOptions {
  auth0Id: string;
  gymId: number;
  gym: Gym;
  subscriptionTier: string;
  passCost?: number | null;
  purchaseId?: number | null;
  validUntilHours?: number;
  incrementVisitsUsed?: boolean;
  sendEmail?: boolean;
  manager?: EntityManager;
}

@Injectable()
export class PassesService {
  private readonly logger = new Logger(PassesService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
    @InjectRepository(PassPurchase)
    private passPurchaseRepository: Repository<PassPurchase>,
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
    @InjectRepository(PassPricing)
    private passPricingRepository: Repository<PassPricing>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private subscriptionsService: SubscriptionsService,
    private usersService: UsersService,
    private sendGridService: SendGridService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    }
  }

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

  private mapPassToResponse(pass: GymPass): PassResponseDto {
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

    const toCoord = (value: number | string | null | undefined): number | null => {
      if (value === null || value === undefined) {
        return null;
      }
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      return Number.isFinite(n) ? n : null;
    };

    const response = {
      id: pass.id,
      user_id: pass.userId,
      gym_id: pass.gymId,
      gym_name: pass.gym?.name || null,
      gym_chain_id: pass.gym?.gymChainId || null,
      gym_chain_name: pass.gym?.gymChain?.name || null,
      gym_chain_logo: pass.gym?.gymChain?.logo || null,
      gym_latitude: toCoord(pass.gym?.latitude),
      gym_longitude: toCoord(pass.gym?.longitude),
      pass_code: pass.passCode,
      status: pass.status,
      valid_until: formatDate(pass.validUntil),
      used_at: formatDate(pass.usedAt),
      qrcode_url: pass.qrcodeUrl || null,
      created_at: formatDate(pass.createdAt) || '',
      updated_at: formatDate(pass.updatedAt) || '',
      subscription_tier: pass.subscriptionTier || null,
      pass_cost: pass.passCost != null ? parseFloat(pass.passCost.toString()) : null,
      purchase_id: pass.purchaseId ?? null,
    };
    return this.removeEmptyValues(response) as PassResponseDto;
  }

  async findByAuth0Id(auth0Id: string, filters?: GetPassesDto): Promise<PassResponseDto[]> {
    try {
      this.logger.log(`Looking up passes for auth0_id: ${auth0Id}${filters?.status ? ` with status: ${filters.status}` : ''}`);

      const queryBuilder = this.gymPassRepository
        .createQueryBuilder('pass')
        .leftJoinAndSelect('pass.gym', 'gym')
        .leftJoinAndSelect('gym.gymChain', 'gymChain')
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
          'pass.passCost',
          'pass.purchaseId',
          'gym.name',
          'gym.gymChainId',
          'gymChain.name',
          'gymChain.logo',
          'gym.latitude',
          'gym.longitude',
        ])
        .where('pass.userId = :auth0Id', { auth0Id });

      if (filters?.status) {
        queryBuilder.andWhere('pass.status = :status', { status: filters.status });
      }

      queryBuilder.orderBy('pass.createdAt', 'DESC');

      const passes = await queryBuilder.getMany();
      this.logger.log(`Found ${passes.length} pass(es) for user: ${auth0Id}`);

      return passes.map((pass) => this.mapPassToResponse(pass));
    } catch (error) {
      this.logger.error(
        `Error in findByAuth0Id: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to fetch passes: ${error.message}`);
    }
  }

  /**
   * From passes ordered newest-first, collect up to five distinct gyms by first appearance.
   */
  private buildRecentGymsFromPasses(passesOrderedNewestFirst: PassResponseDto[]): RecentGymDto[] {
    const recent: RecentGymDto[] = [];
    const seenGymIds = new Set<number>();

    for (const pass of passesOrderedNewestFirst) {
      if (recent.length >= 5) {
        break;
      }
      const gymId = pass.gym_id;
      if (gymId == null || seenGymIds.has(gymId)) {
        continue;
      }
      seenGymIds.add(gymId);
      recent.push({
        gym_id: gymId,
        gym_name: pass.gym_name ?? '',
        gym_chain_id: pass.gym_chain_id ?? 0,
        gym_chain_name: pass.gym_chain_name ?? '',
        gym_chain_logo: pass.gym_chain_logo ?? '',
      });
    }

    return recent;
  }

  recentGymsFromActiveAndHistory(
    activePasses: PassResponseDto[],
    passHistory: PassResponseDto[],
  ): RecentGymDto[] {
    const merged = [...activePasses, ...passHistory].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return this.buildRecentGymsFromPasses(merged);
  }

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

  async createGymPass(options: CreateGymPassOptions): Promise<GymPass> {
    const {
      auth0Id,
      gymId,
      gym,
      subscriptionTier,
      passCost = null,
      purchaseId = null,
      validUntilHours = 2,
      incrementVisitsUsed = false,
      sendEmail = true,
      manager,
    } = options;

    const passRepo = manager ? manager.getRepository(GymPass) : this.gymPassRepository;
    const eventRepo = manager ? manager.getRepository(Event) : this.eventRepository;
    const subscriptionRepo = manager ? manager.getRepository(Subscription) : this.subscriptionRepository;

    const now = new Date();
    const passCode = `PASS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const validUntil = new Date(now.getTime() + validUntilHours * 60 * 60 * 1000);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(passCode)}`;

    const newPass = passRepo.create({
      userId: auth0Id,
      gymId,
      passCode,
      status: 'active',
      validUntil,
      qrcodeUrl: qrCodeUrl,
      createdAt: now,
      updatedAt: now,
      subscriptionTier,
      passCost,
      purchaseId,
    });

    const savedPass = await passRepo.save(newPass);
    this.logger.log(`Pass created successfully with ID: ${savedPass.id}`);

    const user = await this.usersService.findOneByAuth0Id(auth0Id);

    try {
      const eventDescription = `New pass created for ${gym.id}, ${gym.name} by member ${user.full_name || 'Unknown'}`;
      const newEvent = eventRepo.create({
        userId: auth0Id,
        gymId: gymId.toString(),
        gymChainId: gym.gymChainId ? gym.gymChainId.toString() : null,
        eventType: 'pass_created',
        eventDescription,
        createdAt: now,
      });
      await eventRepo.save(newEvent);
    } catch (eventError) {
      this.logger.error(`Failed to create event record: ${eventError.message}`, eventError.stack);
    }

    if (incrementVisitsUsed) {
      const subscriptionEntity = await subscriptionRepo.findOne({
        where: { userId: auth0Id, status: 'active' },
      });

      if (subscriptionEntity) {
        subscriptionEntity.visitsUsed += 1;
        await subscriptionRepo.save(subscriptionEntity);
      }
    }

    if (sendEmail) {
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
        this.logger.error(`Failed to send pass email: ${emailError.message}`, emailError.stack);
      });
    }

    return savedPass;
  }

  async generatePass(auth0Id: string, generatePassDto: GeneratePassDto): Promise<{ message: string; pass_id: number }> {
    try {
      this.logger.log(`Generating pass for auth0_id: ${auth0Id}, gym_id: ${generatePassDto.gym_id}`);

      if (generatePassDto.auth0_id !== auth0Id) {
        throw new ForbiddenException('Access denied: You can only generate passes for yourself');
      }

      const subscriptionEntity = await this.subscriptionsService.findActiveSubscription(auth0Id);
      if (!subscriptionEntity) {
        throw new HttpException({ error: 'Active membership required' }, HttpStatus.FORBIDDEN);
      }

      if (subscriptionEntity.tier === 'free') {
        throw new HttpException(
          {
            error: 'Free tier members must purchase passes individually',
            code: 'FREE_TIER_PURCHASE_REQUIRED',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const subscription = await this.subscriptionsService.findByAuth0Id(auth0Id, { status: 'active' });

      if (subscription.visits_used >= subscription.monthly_limit) {
        throw new BadRequestException(
          `You are out of passes for this month. You have used ${subscription.visits_used} of ${subscription.monthly_limit} available passes.`,
        );
      }

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

      const gym = await this.gymRepository.findOne({
        where: { id: generatePassDto.gym_id },
      });

      if (!gym) {
        throw new NotFoundException('Gym not found');
      }

      if (gym.status !== 'active') {
        throw new BadRequestException('This gym is not currently active');
      }

      if (!this.validateTierAccess(subscription.tier, gym.requiredTier)) {
        throw new ForbiddenException(
          `Your ${subscription.tier} subscription does not allow access to ${gym.requiredTier} tier gyms. ` +
          `Standard subscriptions can access standard gyms, premium can access standard and premium, ` +
          `and elite can access all gym tiers.`,
        );
      }

      const passPricing = await this.passPricingRepository.findOne({
        where: { tier: subscription.tier },
      });

      const savedPass = await this.createGymPass({
        auth0Id,
        gymId: generatePassDto.gym_id,
        gym,
        subscriptionTier: subscription.tier,
        passCost: passPricing ? parseFloat(passPricing.defaultPrice.toString()) : 0,
        validUntilHours: 2,
        incrementVisitsUsed: true,
        sendEmail: true,
      });

      return {
        message: 'Pass generated successfully',
        pass_id: savedPass.id,
      };
    } catch (error) {
      this.logger.error(`Error in generatePass: ${error.message}`, error.stack);
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new Error(`Failed to generate pass: ${error.message}`);
    }
  }

  async purchasePassCheckout(
    auth0Id: string,
    dto: PurchasePassCheckoutDto,
  ): Promise<PurchasePassCheckoutResponseDto> {
    if (dto.auth0_id && dto.auth0_id !== auth0Id) {
      throw new ForbiddenException('Access denied: You can only purchase passes for yourself');
    }

    if (!dto.gym_id) {
      throw new BadRequestException('Gym ID is required');
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const user = await this.userRepository.findOne({ where: { auth0Id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const membership = await this.subscriptionsService.findActiveSubscription(auth0Id);
    if (!membership) {
      throw new HttpException({ error: 'Active membership required' }, HttpStatus.FORBIDDEN);
    }

    if (membership.tier !== 'free') {
      throw new HttpException(
        { error: 'Pass purchase is only available on the free plan' },
        HttpStatus.FORBIDDEN,
      );
    }

    const gym = await this.gymRepository.findOne({ where: { id: dto.gym_id } });
    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    const amount = gym.pricePerPass != null ? parseFloat(gym.pricePerPass.toString()) : 0;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Pass purchase not available at this gym');
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const pendingPurchase = await this.passPurchaseRepository
      .createQueryBuilder('purchase')
      .where('purchase.auth0Id = :auth0Id', { auth0Id })
      .andWhere('purchase.gymId = :gymId', { gymId: dto.gym_id })
      .andWhere('purchase.status = :status', { status: 'pending' })
      .andWhere('purchase.createdAt > :since', { since: thirtyMinAgo })
      .getOne();

    if (pendingPurchase) {
      throw new HttpException(
        { error: 'You already have a pending purchase for this gym' },
        HttpStatus.CONFLICT,
      );
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.subscriptionsService.ensureStripeCustomer(user);
      user.stripeCustomerId = customerId;
      await this.userRepository.save(user);
    }

    const purchase = this.passPurchaseRepository.create({
      auth0Id,
      gymId: dto.gym_id,
      amount,
      currency: 'gbp',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const savedPurchase = await this.passPurchaseRepository.save(purchase);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Gym Pass — ${gym.name}`,
              metadata: { gym_id: String(dto.gym_id) },
            },
          },
          quantity: 1,
        },
      ],
      success_url: dto.success_url,
      cancel_url: dto.cancel_url,
      metadata: {
        auth0_id: auth0Id,
        gym_id: String(dto.gym_id),
        purchase_type: 'single_pass',
        price_per_pass: String(amount),
        pass_purchase_id: String(savedPurchase.id),
      },
    });

    savedPurchase.stripeCheckoutSessionId = session.id;
    savedPurchase.updatedAt = new Date();
    await this.passPurchaseRepository.save(savedPurchase);

    return {
      session_id: session.id,
      checkout_url: session.url,
    };
  }

  async findPassesWithSubscription(auth0Id: string): Promise<PassesWithSubscriptionResponseDto> {
    try {
      this.logger.log(`Looking up passes with subscription for auth0_id: ${auth0Id}`);

      const allPasses = await this.findByAuth0Id(auth0Id);
      const now = new Date();

      const activePasses = allPasses.filter(pass => {
        if (!pass.valid_until) return false;
        return new Date(pass.valid_until) > now;
      });
      const passHistory = allPasses.filter(pass => {
        if (!pass.valid_until) return true;
        return new Date(pass.valid_until) <= now;
      });

      const recentGyms = this.recentGymsFromActiveAndHistory(activePasses, passHistory);

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
        } else {
          this.logger.error(
            `Error fetching subscription for user ${auth0Id}: ${error.message}`,
            error.stack,
          );
        }
      }

      return {
        subscription: subscriptionSummary,
        active_passes: activePasses,
        pass_history: passHistory,
        recent_gyms: recentGyms,
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
