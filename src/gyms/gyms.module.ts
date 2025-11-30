import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GymsController } from './gyms.controller';
import { GymsService } from './gyms.service';
import { Gym } from './entities/gym.entity';
import { GymChain } from './entities/gym-chain.entity';
import { Rating } from './entities/rating.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Gym, GymChain, Rating])],
  controllers: [GymsController],
  providers: [GymsService],
})
export class GymsModule {}

