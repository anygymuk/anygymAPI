import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { GymPass } from './entities/gym-pass.entity';
import { Auth0Guard } from '../users/guards/auth0.guard';

@Module({
  imports: [TypeOrmModule.forFeature([GymPass])],
  controllers: [PassesController],
  providers: [PassesService, Auth0Guard],
})
export class PassesModule {}

