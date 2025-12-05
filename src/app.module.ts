import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GymsModule } from './gyms/gyms.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PassesModule } from './passes/passes.module';
import { StripeModule } from './stripe/stripe.module';
import { ContentModule } from './content/content.module';
import { Gym } from './gyms/entities/gym.entity';
import { GymChain } from './gyms/entities/gym-chain.entity';
import { Rating } from './gyms/entities/rating.entity';
import { User } from './users/entities/user.entity';
import { AdminUser } from './users/entities/admin-user.entity';
import { Event } from './users/entities/event.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { GymPass } from './passes/entities/gym-pass.entity';
import { PassPricing } from './passes/entities/pass-pricing.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
          entities: [Gym, GymChain, Rating, User, AdminUser, Event, Subscription, GymPass, PassPricing],
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
    StripeModule,
    ContentModule,
  ],
})
export class AppModule {}

