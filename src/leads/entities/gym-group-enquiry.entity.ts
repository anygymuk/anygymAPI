import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type GymGroupLocations = '1-5' | '6-10' | '11-20' | '21-50' | '50+';

@Entity('gym_group_enquiries')
export class GymGroupEnquiry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'contact_name' })
  contactName: string;

  @Column()
  email: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column()
  locations: GymGroupLocations;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
