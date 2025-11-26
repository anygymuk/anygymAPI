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

  @OneToMany(() => Gym, (gym) => gym.gymChain)
  gyms: Gym[];
}

