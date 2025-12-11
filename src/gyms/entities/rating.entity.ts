import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Gym } from './gym.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ratings')
export class Rating {
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

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  rating: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

