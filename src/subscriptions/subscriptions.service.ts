import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { GetSubscriptionDto } from './dto/get-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
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
}

