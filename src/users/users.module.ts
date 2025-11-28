import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { GymPass } from '../passes/entities/gym-pass.entity';
import { Gym } from '../gyms/entities/gym.entity';
import { Auth0Guard } from './guards/auth0.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, GymPass, Gym])],
  controllers: [UsersController],
  providers: [UsersService, Auth0Guard],
  exports: [UsersService],
})
export class UsersModule {}

