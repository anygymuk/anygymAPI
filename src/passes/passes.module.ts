import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { GymPass } from './entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { PassPricing } from './entities/pass-pricing.entity';
import { Auth0Guard } from '../users/guards/auth0.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { SendGridService } from './services/sendgrid.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GymPass, Gym, PassPricing]),
    SubscriptionsModule,
    UsersModule,
  ],
  controllers: [PassesController],
  providers: [PassesService, Auth0Guard, SendGridService],
})
export class PassesModule {}

