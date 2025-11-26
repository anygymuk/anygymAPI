import {
  Controller,
  Get,
  Headers,
  Query,
  ForbiddenException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Auth0Guard } from '../users/guards/auth0.guard';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { GetSubscriptionDto } from './dto/get-subscription.dto';

@Controller('user/subscription')
@UseGuards(Auth0Guard)
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async getSubscription(
    @Headers('auth0_id') auth0Id: string,
    @Query() query: GetSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    try {
      this.logger.log(`GET /user/subscription called with auth0_id: ${auth0Id}${query.status ? `, status: ${query.status}` : ''}`);

      // The Auth0Guard ensures auth0_id is present in headers
      // Fetch the subscription by the auth0_id from the header
      // This ensures users can only access their own subscription data
      const subscription = await this.subscriptionsService.findByAuth0Id(auth0Id, query);

      // Additional security check: Verify the returned subscription matches the requested auth0_id
      if (subscription.user_id !== auth0Id) {
        this.logger.warn(
          `Auth0 ID mismatch: requested ${auth0Id}, got ${subscription.user_id}`,
        );
        throw new ForbiddenException(
          'Access denied: You can only access your own subscription',
        );
      }

      return subscription;
    } catch (error) {
      this.logger.error(`Error in getSubscription: ${error.message}`, error.stack);
      throw error;
    }
  }
}

