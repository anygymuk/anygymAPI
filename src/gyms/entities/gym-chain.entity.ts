import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Gym } from './gym.entity';

@Entity('gym_chains')
export class GymChain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'logo_url', nullable: true })
  logo: string;

  @Column({ name: 'brand_color', nullable: true })
  brandColor: string;

  @Column({ nullable: true })
  website: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ name: 'health_statement', type: 'text', nullable: true })
  healthStatement: string;

  @Column({ name: 'terms_url', nullable: true })
  termsUrl: string;

  @Column({ name: 'health_statement_url', nullable: true })
  healthStatementUrl: string;

  @Column({ name: 'use_terms_url', default: false })
  useTermsUrl: boolean;

  @Column({ name: 'use_health_statement_url', default: false })
  useHealthStatementUrl: boolean;

  @OneToMany(() => Gym, (gym) => gym.gymChain)
  gyms: Gym[];
}

