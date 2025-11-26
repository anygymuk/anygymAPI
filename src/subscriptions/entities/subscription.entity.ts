import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'auth0Id' })
  user: User;

  @Column()
  tier: string;

  @Column({ name: 'monthly_limit' })
  monthlyLimit: number;

  @Column({ name: 'visits_used', default: 0 })
  visitsUsed: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'next_billing_date', type: 'date', nullable: true })
  nextBillingDate: Date;

  @Column()
  status: string;

  @Column({ name: 'stripe_subscription_id', nullable: true })
  stripeSubscriptionId: string;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId: string;

  @Column({ name: 'guest_passes_limit', default: 0 })
  guestPassesLimit: number;

  @Column({ name: 'guest_passes_used', default: 0 })
  guestPassesUsed: number;
}

