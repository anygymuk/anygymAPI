import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { GymPass } from './entities/gym-pass.entity';
import { PassPurchase } from './entities/pass-purchase.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPricing } from './entities/pass-pricing.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Event } from '../users/entities/event.entity';
import { User } from '../users/entities/user.entity';
import { Auth0Guard } from '../users/guards/auth0.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { SendGridService } from './services/sendgrid.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GymPass, PassPurchase, Gym, PassPricing, Subscription, Event, User]),
    SubscriptionsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [PassesController],
  providers: [PassesService, Auth0Guard, SendGridService],
  exports: [PassesService],
})
export class PassesModule {}

