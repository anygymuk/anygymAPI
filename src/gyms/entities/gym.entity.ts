import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GymChain } from './gym-chain.entity';

@Entity('gyms')
export class Gym {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'gym_chain_id', nullable: true })
  gymChainId: number;

  @ManyToOne(() => GymChain)
  @JoinColumn({ name: 'gym_chain_id' })
  gymChain: GymChain;

  @Column()
  address: string;

  @Column()
  postcode: string;

  @Column()
  city: string;

  @Column('decimal', { precision: 10, scale: 8 })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8 })
  longitude: number;

  @Column({ name: 'required_tier' })
  requiredTier: string;

  @Column('jsonb', { nullable: true })
  amenities: string[];

  @Column({ name: 'opening_hours', type: 'jsonb', nullable: true })
  openingHours: any;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  rating: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ default: 'active' })
  status: string;
}

