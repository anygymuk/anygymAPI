import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'admin_user', nullable: true })
  adminUser: string;

  @Column({ name: 'gym_id', nullable: true })
  gymId: string;

  @Column({ name: 'gym_chain_id', nullable: true })
  gymChainId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ name: 'event_description', type: 'text' })
  eventDescription: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
