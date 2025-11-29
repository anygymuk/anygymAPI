import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { GeocodingService } from './services/geocoding.service';
import { SendGridService } from '../passes/services/sendgrid.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, Gym])],
  controllers: [StripeController],
  providers: [StripeService, GeocodingService, SendGridService],
  exports: [StripeService],
})
export class StripeModule {}

