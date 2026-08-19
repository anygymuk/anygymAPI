import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { Auth0Guard } from '../users/guards/auth0.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, User])],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, Auth0Guard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

