import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { ChainsController } from './chains.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { AdminUser } from './entities/admin-user.entity';
import { Event } from './entities/event.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { GymChain } from '../gyms/entities/gym-chain.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Auth0Guard } from './guards/auth0.guard';
import { Auth0Service } from './services/auth0.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AdminUser, Event, GymPass, Gym, GymChain, Subscription])],
  controllers: [UsersController, AdminController, ChainsController],
  providers: [UsersService, Auth0Guard, Auth0Service],
  exports: [UsersService],
})
export class UsersModule {}

