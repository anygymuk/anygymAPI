import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { NewsletterSubscription } from './entities/newsletter-subscription.entity';
import { GymGroupEnquiry } from './entities/gym-group-enquiry.entity';
import { InvestorEnquiry } from './entities/investor-enquiry.entity';
import { LeadsEmailService } from './services/leads-email.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NewsletterSubscription,
      GymGroupEnquiry,
      InvestorEnquiry,
    ]),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsEmailService, RateLimitGuard],
})
export class LeadsModule {}
