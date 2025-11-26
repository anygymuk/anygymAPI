import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_users')
export class User {
  @PrimaryColumn({ name: 'auth0_id' })
  auth0Id: string;

  @Column()
  email: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted: boolean;

  @Column({ name: 'address_line1', nullable: true })
  addressLine1: string;

  @Column({ name: 'address_line2', nullable: true })
  addressLine2: string;

  @Column({ name: 'address_city', nullable: true })
  addressCity: string;

  @Column({ name: 'address_postcode', nullable: true })
  addressPostcode: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_number', nullable: true })
  emergencyContactNumber: string;
}

