import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Gym } from '../../gyms/entities/gym.entity';

@Entity('gym_passes')
export class GymPass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'auth0Id' })
  user: User;

  @Column({ name: 'gym_id' })
  gymId: number;

  @ManyToOne(() => Gym)
  @JoinColumn({ name: 'gym_id' })
  gym: Gym;

  @Column({ name: 'pass_code' })
  passCode: string;

  @Column()
  status: string;

  @Column({ name: 'valid_until', type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date;

  @Column({ name: 'qrcode_url', nullable: true })
  qrcodeUrl: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'subscription_tier', nullable: true })
  subscriptionTier: string;
}

