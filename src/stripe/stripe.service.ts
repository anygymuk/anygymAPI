import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { GeocodingService } from './services/geocoding.service';
import { SendGridService } from '../passes/services/sendgrid.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Gym)
    private gymRepository: Repository<Gym>,
    private geocodingService: GeocodingService,
    private sendGridService: SendGridService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set in environment variables');
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Find the closest 3 gyms to given coordinates
   */
  async findClosestGyms(
    latitude: number,
    longitude: number,
  ): Promise<Gym[]> {
    const gyms = await this.gymRepository
      .createQueryBuilder('gym')
      .leftJoinAndSelect('gym.gymChain', 'gymChain')
      .where('gym.status = :status', { status: 'active' })
      .andWhere('gym.latitude IS NOT NULL')
      .andWhere('gym.longitude IS NOT NULL')
      .getMany();

    // Filter out any gyms with null coordinates (safety check)
    const gymsWithCoordinates = gyms.filter(
      (gym) => gym.latitude != null && gym.longitude != null,
    );

    if (gymsWithCoordinates.length === 0) {
      this.logger.warn('No gyms with coordinates found');
      return [];
    }

    // Calculate distances and sort
    const gymsWithDistance = gymsWithCoordinates
      .map((gym) => {
        const gymLat = parseFloat(gym.latitude.toString());
        const gymLon = parseFloat(gym.longitude.toString());
        return {
          gym,
          distance: this.calculateDistance(latitude, longitude, gymLat, gymLon),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => item.gym);

    return gymsWithDistance;
  }

  async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    try {
      this.logger.log(`Processing checkout session: ${session.id}`);

      // Step 1: Extract membership tier from session metadata or line items
      const tier = session.metadata?.tier || session.metadata?.membership_tier;
      if (!tier) {
        throw new Error('Membership tier not found in session metadata');
      }

      // Step 2: Fetch customer details from Stripe
      const customerId = session.customer as string;
      if (!customerId) {
        throw new Error('Customer ID not found in session');
      }

      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }

      // Type guard: customer is not deleted, so it's a Customer object
      const activeCustomer = customer as Stripe.Customer;
      const auth0Id = activeCustomer.metadata?.auth0_id;
      const postcode = activeCustomer.metadata?.postcode || session.metadata?.postcode;

      if (!auth0Id) {
        throw new Error('auth0_id not found in customer metadata');
      }

      this.logger.log(`Processing subscription for auth0_id: ${auth0Id}, tier: ${tier}`);

      // Step 3: Update app_users table with Stripe customer ID
      await this.userRepository.update(
        { auth0Id },
        { stripeCustomerId: customerId },
      );

      // Step 4: Cancel any existing active subscriptions
      await this.subscriptionRepository.update(
        { userId: auth0Id, status: 'active' },
        { status: 'cancelled' },
      );

      // Step 5: Get subscription details from Stripe
      const subscriptionId = session.subscription as string;
      let subscription: Stripe.Subscription | null = null;
      if (subscriptionId) {
        subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      }

      // Determine subscription limits based on tier
      const tierLimits: { [key: string]: { monthlyLimit: number; guestPassesLimit: number; price: number } } = {
        standard: { monthlyLimit: 5, guestPassesLimit: 0, price: 19.99 },
        premium: { monthlyLimit: 10, guestPassesLimit: 2, price: 29.99 },
        elite: { monthlyLimit: 20, guestPassesLimit: 5, price: 49.99 },
      };

      const limits = tierLimits[tier.toLowerCase()] || tierLimits.standard;

      // Step 6: Create new subscription record
      const startDate = subscription?.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : new Date();
      const nextBillingDate = subscription?.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;

      const newSubscription = this.subscriptionRepository.create({
        userId: auth0Id,
        tier,
        monthlyLimit: limits.monthlyLimit,
        visitsUsed: 0,
        price: limits.price,
        startDate,
        nextBillingDate,
        status: 'active',
        stripeSubscriptionId: subscriptionId || null,
        stripeCustomerId: customerId,
        guestPassesLimit: limits.guestPassesLimit,
        guestPassesUsed: 0,
      });

      await this.subscriptionRepository.save(newSubscription);
      this.logger.log(`Subscription created for user: ${auth0Id}`);

      // Step 7: Geocode postcode if available
      let coordinates: { latitude: number; longitude: number } | null = null;
      if (postcode) {
        coordinates = await this.geocodingService.geocodePostcode(postcode);
        if (coordinates) {
          // Update user with coordinates if we have address fields
          await this.userRepository.update(
            { auth0Id },
            {
              addressPostcode: postcode,
            },
          );
        }
      }

      // Step 8: Find closest gyms
      let closestGyms: Gym[] = [];
      if (coordinates) {
        closestGyms = await this.findClosestGyms(
          coordinates.latitude,
          coordinates.longitude,
        );
      }

      // Step 9: Get user details for email
      const user = await this.userRepository.findOne({
        where: { auth0Id },
      });

      if (!user) {
        throw new Error(`User not found: ${auth0Id}`);
      }

      // Determine if this is a new customer (no previous subscriptions)
      const previousSubscriptions = await this.subscriptionRepository.count({
        where: { userId: auth0Id, status: 'cancelled' },
      });
      const isNewCustomer = previousSubscriptions === 0;

      // Step 10: Prepare gym data for email
      const gymData = closestGyms.slice(0, 3).map((gym, index) => ({
        name: gym.name,
        address: gym.address,
        postcode: gym.postcode,
        city: gym.city,
        url: `${process.env.FRONTEND_URL || 'https://any-gym.com'}/gyms/${gym.id}`,
        image: gym.gymChain?.logo || '',
      }));

      // Step 11: Send welcome email
      await this.sendGridService.sendWelcomeEmail({
        to: user.email,
        recipientName: user.fullName || 'Valued Member',
        membershipName: tier.charAt(0).toUpperCase() + tier.slice(1),
        gym1: gymData[0],
        gym2: gymData[1],
        gym3: gymData[2],
        isNewCustomer,
      });

      this.logger.log(`Checkout session processed successfully: ${session.id}`);
    } catch (error) {
      this.logger.error(
        `Error processing checkout session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      this.logger.log(`Processing subscription update: ${subscription.id}`);

      // Find the subscription by stripe_subscription_id
      const dbSubscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!dbSubscription) {
        this.logger.warn(
          `Subscription not found for stripe_subscription_id: ${subscription.id}`,
        );
        throw new Error(
          `Subscription not found for stripe_subscription_id: ${subscription.id}`,
        );
      }

      // Helper function to normalize dates (handle both Date objects and strings)
      const normalizeDate = (date: Date | string | null | undefined): Date | null => {
        if (!date) return null;
        if (date instanceof Date) return date;
        if (typeof date === 'string') return new Date(date);
        return null;
      };

      // Track if period dates are being updated to reset usage counters
      // Convert to Date objects for comparison (DB might return strings)
      const oldPeriodStart = normalizeDate(dbSubscription.startDate);
      const oldPeriodEnd = normalizeDate(dbSubscription.nextBillingDate);
      
      // Map webhook data to database fields
      const updateData: Partial<Subscription> = {};

      // Map current_period_end to nextBillingDate
      // Note: The user mentioned next_pending_invoice_item_invoice, but that's not a standard
      // Stripe subscription field. Using current_period_end as the next billing date.
      // Also check items.data[0] if current_period_end is not directly on subscription
      let periodEnd: number | undefined = subscription.current_period_end;
      if (!periodEnd && subscription.items?.data?.[0]) {
        // Fallback: check if period info is in items (though this is non-standard)
        periodEnd = (subscription.items.data[0] as any).current_period_end;
      }
      
      if (periodEnd) {
        updateData.nextBillingDate = new Date(periodEnd * 1000);
      }

      // Map current_period_start to startDate
      let periodStart: number | undefined = subscription.current_period_start;
      if (!periodStart && subscription.items?.data?.[0]) {
        // Fallback: check if period info is in items (though this is non-standard)
        periodStart = (subscription.items.data[0] as any).current_period_start;
      }
      
      if (periodStart) {
        updateData.startDate = new Date(periodStart * 1000);
      }

      // Verify stripe_subscription_id matches (should always match since we found by it)
      // The webhook subscription.id maps to stripe_subscription_id in DB
      if (subscription.id !== dbSubscription.stripeSubscriptionId) {
        this.logger.warn(
          `Stripe subscription ID mismatch: webhook ${subscription.id} vs DB ${dbSubscription.stripeSubscriptionId}`,
        );
      }

      // Check if period dates changed - if so, reset usage counters
      const newPeriodStart = periodStart
        ? new Date(periodStart * 1000)
        : null;
      const newPeriodEnd = periodEnd
        ? new Date(periodEnd * 1000)
        : null;

      const periodStartChanged =
        newPeriodStart &&
        oldPeriodStart &&
        newPeriodStart.getTime() !== oldPeriodStart.getTime();
      
      const periodEndChanged =
        newPeriodEnd &&
        oldPeriodEnd &&
        newPeriodEnd.getTime() !== oldPeriodEnd.getTime();

      if (periodStartChanged || periodEndChanged) {
        updateData.visitsUsed = 0;
        updateData.guestPassesUsed = 0;
        this.logger.log(
          `Period dates changed, resetting visits_used and guest_passes_used to 0`,
        );
      }

      // Only update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        await this.subscriptionRepository.update(
          { id: dbSubscription.id },
          updateData,
        );
        this.logger.log(
          `Subscription updated successfully: ${subscription.id}`,
        );
      } else {
        this.logger.log(
          `No updates needed for subscription: ${subscription.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing subscription update: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

