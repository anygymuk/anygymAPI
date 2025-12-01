import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GymChain } from '../../gyms/entities/gym-chain.entity';

@Entity('admin_users')
export class AdminUser {
  @PrimaryColumn({ name: 'auth0_id' })
  auth0Id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'gym_chain_id', nullable: true })
  gymChainId: number;

  @ManyToOne(() => GymChain)
  @JoinColumn({ name: 'gym_chain_id' })
  gymChain: GymChain;

  @Column({ nullable: true })
  role: string;

  @Column({ name: 'access_gyms', type: 'jsonb', nullable: true })
  accessGyms: number[];
}

