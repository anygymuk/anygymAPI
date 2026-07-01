import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Gym } from '../../gyms/entities/gym.entity';
import { GymPass } from './gym-pass.entity';

@Entity('pass_purchases')
export class PassPurchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'auth0_id' })
  auth0Id: string;

  @Column({ name: 'gym_id' })
  gymId: number;

  @ManyToOne(() => Gym)
  @JoinColumn({ name: 'gym_id' })
  gym: Gym;

  @Column({ name: 'pass_id', nullable: true })
  passId: number;

  @ManyToOne(() => GymPass, { nullable: true })
  @JoinColumn({ name: 'pass_id' })
  pass: GymPass;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'gbp' })
  currency: string;

  @Column({ name: 'stripe_checkout_session_id', nullable: true, unique: true })
  stripeCheckoutSessionId: string;

  @Column({ name: 'stripe_payment_intent_id', nullable: true })
  stripePaymentIntentId: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;
}
