import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { User } from '../users/entities/user.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPurchase } from '../passes/entities/pass-purchase.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { GeocodingService } from './services/geocoding.service';
import { SendGridService } from '../passes/services/sendgrid.service';
import { PassesModule } from '../passes/passes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription, Gym, PassPurchase, GymPass]),
    forwardRef(() => PassesModule),
  ],
  controllers: [StripeController],
  providers: [StripeService, GeocodingService, SendGridService],
  exports: [StripeService],
})
export class StripeModule {}

