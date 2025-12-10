import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymPass } from './entities/gym-pass.entity';

@Injectable()
export class PassesCronService {
  private readonly logger = new Logger(PassesCronService.name);

  constructor(
    @InjectRepository(GymPass)
    private gymPassRepository: Repository<GymPass>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePasses() {
    this.logger.log('Running cron job to expire passes...');

    try {
      const now = new Date();
      
      // Directly update all passes with status 'active' where valid_until has lapsed
      const updateResult = await this.gymPassRepository
        .createQueryBuilder()
        .update(GymPass)
        .set({ status: 'expired' })
        .where('status = :status', { status: 'active' })
        .andWhere('valid_until IS NOT NULL')
        .andWhere('valid_until <= :now', { now })
        .execute();

      const affectedCount = updateResult.affected || 0;
      
      if (affectedCount === 0) {
        this.logger.log('No passes to expire');
      } else {
        this.logger.log(`Successfully expired ${affectedCount} pass(es)`);
      }
    } catch (error) {
      this.logger.error(
        `Error expiring passes: ${error.message}`,
        error.stack,
      );
    }
  }
}
