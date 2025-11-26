import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GymsModule } from './gyms/gyms.module';
import { Gym } from './gyms/entities/gym.entity';
import { GymChain } from './gyms/entities/gym-chain.entity';

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
          entities: [Gym, GymChain],
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
  ],
})
export class AppModule {}

