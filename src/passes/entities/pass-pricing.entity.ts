import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('pass_pricing')
export class PassPricing {
  @PrimaryColumn()
  tier: string;

  @Column({ name: 'default_price', type: 'decimal', precision: 10, scale: 2 })
  defaultPrice: number;
}


