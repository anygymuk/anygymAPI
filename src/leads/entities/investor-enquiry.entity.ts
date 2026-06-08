import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type InvestmentRange =
  | 'under-100k'
  | '100k-500k'
  | '500k-1m'
  | '1m-plus'
  | 'strategic';

@Entity('investor_enquiries')
export class InvestorEnquiry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  company: string | null;

  @Column({ name: 'investment_range', nullable: true })
  investmentRange: InvestmentRange | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'investor_pack_sent', default: false })
  investorPackSent: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
