import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { AdminController } from './admin.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { AdminUser } from './entities/admin-user.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { GymChain } from '../gyms/entities/gym-chain.entity';
import { Auth0Guard } from './guards/auth0.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, AdminUser, GymPass, Gym, GymChain])],
  controllers: [UsersController, AdminController],
  providers: [UsersService, Auth0Guard],
  exports: [UsersService],
})
export class UsersModule {}

