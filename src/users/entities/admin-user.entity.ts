import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('admin_users')
export class AdminUser {
  @PrimaryColumn({ name: 'auth0_id' })
  auth0Id: string;
}

