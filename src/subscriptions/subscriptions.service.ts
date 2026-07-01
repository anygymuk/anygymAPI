import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { GetSubscriptionDto } from './dto/get-subscription.dto';
import { MembershipResponseDto } from '../users/dto/membership-response.dto';
import { User } from '../users/entities/user.entity';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set in environment variables');
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

  formatMembership(subscription: Subscription): MembershipResponseDto {
    const formatDate = (date: Date | null): string | null => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      if (typeof date === 'string') {
        return new Date(date).toISOString().split('T')[0];
      }
      return null;
    };

    const formatTimestamp = (date: Date | null): string | null => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.toISOString();
      }
      if (typeof date === 'string') {
        return new Date(date).toISOString();
      }
      return null;
    };

    return {
      id: subscription.id,
      user_id: subscription.userId,
      tier: subscription.tier,
      status: subscription.status,
      monthly_limit: subscription.monthlyLimit,
      visits_used: subscription.visitsUsed,
      guest_passes_limit: subscription.guestPassesLimit,
      guest_passes_used: subscription.guestPassesUsed,
      price: parseFloat(subscription.price.toString()),
      stripe_subscription_id: subscription.stripeSubscriptionId || null,
      stripe_customer_id: subscription.stripeCustomerId || null,
      current_period_start: formatTimestamp(subscription.currentPeriodStart),
      current_period_end: formatTimestamp(subscription.currentPeriodEnd),
      next_billing_date: formatDate(subscription.nextBillingDate),
      created_at: formatTimestamp(subscription.startDate),
      updated_at: formatTimestamp(subscription.currentPeriodStart),
    };
  }

  async findActiveSubscription(auth0Id: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { userId: auth0Id, status: 'active' },
    });
  }

  async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: { auth0_id: user.auth0Id },
    });

    return customer.id;
  }

  async assignFreeTier(
    auth0Id: string,
    stripeCustomerId: string | null,
  ): Promise<Subscription> {
    const active = await this.findActiveSubscription(auth0Id);

    if (active?.stripeSubscriptionId) {
      this.logger.log(
        `User ${auth0Id} has active paid subscription; skipping free tier assignment`,
      );
      return active;
    }

    if (active?.tier === 'free') {
      this.logger.log(`User ${auth0Id} already on free tier`);
      return active;
    }

    if (active) {
      active.status = 'cancelled';
      await this.subscriptionRepository.save(active);
    }

    const now = new Date();
    const freeSubscription = this.subscriptionRepository.create({
      userId: auth0Id,
      tier: 'free',
      monthlyLimit: 0,
      visitsUsed: 0,
      price: 0,
      startDate: now,
      nextBillingDate: null,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: stripeCustomerId,
      guestPassesLimit: 0,
      guestPassesUsed: 0,
    });

    return this.subscriptionRepository.save(freeSubscription);
  }

  async findByAuth0Id(auth0Id: string, filters?: GetSubscriptionDto): Promise<SubscriptionResponseDto> {
    try {
      this.logger.log(`Looking up subscription for auth0_id: ${auth0Id}${filters?.status ? ` with status: ${filters.status}` : ''}`);

      // Find subscription by user_id (which is auth0_id)
      const queryBuilder = this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select([
          'subscription.id',
          'subscription.userId',
          'subscription.tier',
          'subscription.monthlyLimit',
          'subscription.visitsUsed',
          'subscription.price',
          'subscription.startDate',
          'subscription.nextBillingDate',
          'subscription.currentPeriodStart',
          'subscription.currentPeriodEnd',
          'subscription.status',
          'subscription.stripeSubscriptionId',
          'subscription.stripeCustomerId',
          'subscription.guestPassesLimit',
          'subscription.guestPassesUsed',
        ])
        .where('subscription.userId = :auth0Id', { auth0Id });

      // Filter by status if provided
      if (filters?.status) {
        queryBuilder.andWhere('subscription.status = :status', { status: filters.status });
      }

      const subscription = await queryBuilder.getOne();

      if (!subscription) {
        const statusMessage = filters?.status 
          ? ` with status '${filters.status}'` 
          : '';
        const errorMessage = `No subscription found for this user${statusMessage}`;
        this.logger.warn(`Subscription not found for auth0_id: ${auth0Id}${statusMessage}`);
        throw new NotFoundException(errorMessage);
      }

      this.logger.log(`Subscription found for user: ${auth0Id}`);

      // Format dates
      const formatDate = (date: Date | null): string | null => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        if (typeof date === 'string') {
          return new Date(date).toISOString().split('T')[0];
        }
        return null;
      };

      // Format timestamps (for current_period_start and current_period_end)
      const formatTimestamp = (date: Date | null): string | null => {
        if (!date) return null;
        if (date instanceof Date) {
          return date.toISOString();
        }
        if (typeof date === 'string') {
          return new Date(date).toISOString();
        }
        return null;
      };

      const response = {
        id: subscription.id,
        user_id: subscription.userId,
        tier: subscription.tier,
        monthly_limit: subscription.monthlyLimit,
        visits_used: subscription.visitsUsed,
        price: parseFloat(subscription.price.toString()),
        start_date: formatDate(subscription.startDate) || '',
        next_billing_date: formatDate(subscription.nextBillingDate),
        current_period_start: formatTimestamp(subscription.currentPeriodStart),
        current_period_end: formatTimestamp(subscription.currentPeriodEnd),
        status: subscription.status,
        stripe_subscription_id: subscription.stripeSubscriptionId || null,
        stripe_customer_id: subscription.stripeCustomerId || null,
        guest_passes_limit: subscription.guestPassesLimit,
        guest_passes_used: subscription.guestPassesUsed,
      };
      return this.removeEmptyValues(response) as SubscriptionResponseDto;
    } catch (error) {
      this.logger.error(
        `Error in findByAuth0Id: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }
  }

  async cancelSubscription(auth0Id: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Cancelling subscription for auth0_id: ${auth0Id}`);

      // Step 1: Find the user's active subscription
      const subscription = await this.subscriptionRepository.findOne({
        where: { userId: auth0Id, status: 'active' },
      });

      if (!subscription) {
        throw new NotFoundException('No active subscription found for this user');
      }

      if (!subscription.stripeSubscriptionId) {
        throw new BadRequestException('Subscription does not have a Stripe subscription ID');
      }

      // Step 2: Cancel the subscription in Stripe
      try {
        const canceledSubscription = await this.stripe.subscriptions.cancel(
          subscription.stripeSubscriptionId,
        );

        this.logger.log(
          `Stripe subscription canceled: ${canceledSubscription.id}, status: ${canceledSubscription.status}`,
        );

        // Step 3: Verify the status is 'canceled'
        if (canceledSubscription.status !== 'canceled') {
          throw new Error(
            `Stripe returned status '${canceledSubscription.status}' instead of 'canceled'`,
          );
        }

        // Step 4: Update the subscription record in the database
        subscription.status = 'cancelled';
        await this.subscriptionRepository.save(subscription);

        this.logger.log(`Subscription ${subscription.id} marked as cancelled in database`);

        return { message: 'Subscription cancelled successfully' };
      } catch (stripeError) {
        this.logger.error(
          `Stripe error cancelling subscription: ${stripeError.message}`,
          stripeError.stack,
        );

        // Re-throw Stripe errors as BadRequestException with the error message
        throw new BadRequestException(
          `Failed to cancel subscription in Stripe: ${stripeError.message}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error in cancelSubscription: ${error.message}`, error.stack);

      // Re-throw known exceptions as-is
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Wrap other errors
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }
}

