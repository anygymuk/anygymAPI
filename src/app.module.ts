import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GymsModule } from './gyms/gyms.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PassesModule } from './passes/passes.module';
import { PassesCronModule } from './passes/passes-cron.module';
import { StripeModule } from './stripe/stripe.module';
import { ContentModule } from './content/content.module';
import { LeadsModule } from './leads/leads.module';
import { Gym } from './gyms/entities/gym.entity';
import { GymChain } from './gyms/entities/gym-chain.entity';
import { Rating } from './gyms/entities/rating.entity';
import { User } from './users/entities/user.entity';
import { AdminUser } from './users/entities/admin-user.entity';
import { Event } from './users/entities/event.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { GymPass } from './passes/entities/gym-pass.entity';
import { PassPricing } from './passes/entities/pass-pricing.entity';
import { PassPurchase } from './passes/entities/pass-purchase.entity';
import { NewsletterSubscription } from './leads/entities/newsletter-subscription.entity';
import { GymGroupEnquiry } from './leads/entities/gym-group-enquiry.entity';
import { InvestorEnquiry } from './leads/entities/investor-enquiry.entity';

const isPassExpiryCronEnabled =
  process.env.PASS_EXPIRY_CRON_ENABLED !== 'false';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is not set');
        }

        return {
          type: 'postgres',
          url: databaseUrl,
          entities: [
            Gym,
            GymChain,
            Rating,
            User,
            AdminUser,
            Event,
            Subscription,
            GymPass,
            PassPricing,
            PassPurchase,
            NewsletterSubscription,
            GymGroupEnquiry,
            InvestorEnquiry,
          ],
          synchronize: false,
          ssl: {
            rejectUnauthorized: false,
          },
          extra: {
            ssl: {
              rejectUnauthorized: false,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    GymsModule,
    UsersModule,
    SubscriptionsModule,
    PassesModule,
    ...(isPassExpiryCronEnabled ? [PassesCronModule] : []),
    StripeModule,
    ContentModule,
    LeadsModule,
  ],
})
export class AppModule {}

