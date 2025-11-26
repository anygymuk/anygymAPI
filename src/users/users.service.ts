import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findOneByAuth0Id(auth0Id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { auth0Id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      auth0_id: user.auth0Id,
      email: user.email,
      full_name: user.fullName,
      onboarding_completed: user.onboardingCompleted,
      address_line1: user.addressLine1,
      address_line2: user.addressLine2,
      address_city: user.addressCity,
      address_postcode: user.addressPostcode,
      date_of_birth: user.dateOfBirth
        ? user.dateOfBirth.toISOString().split('T')[0]
        : null,
      stripe_customer_id: user.stripeCustomerId,
      emergency_contact_name: user.emergencyContactName,
      emergency_contact_number: user.emergencyContactNumber,
    };
  }

  async verifyAuth0IdMatches(auth0Id: string, requestedAuth0Id: string): Promise<boolean> {
    return auth0Id === requestedAuth0Id;
  }
}

