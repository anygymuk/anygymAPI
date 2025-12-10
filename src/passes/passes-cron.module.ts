import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassesCronService } from './passes-cron.service';
import { GymPass } from './entities/gym-pass.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GymPass])],
  providers: [PassesCronService],
})
export class PassesCronModule {}
