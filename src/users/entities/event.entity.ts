import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'admin_user' })
  adminUser: string;

  @Column({ name: 'gym_id' })
  gymId: number;

  @Column({ name: 'gym_chain_id', nullable: true })
  gymChainId: number;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column({ name: 'event_description', type: 'text' })
  eventDescription: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}

