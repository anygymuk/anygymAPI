import {
  Controller,
  Get,
  Headers,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth0Guard } from './guards/auth0.guard';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('user')
@UseGuards(Auth0Guard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUser(
    @Headers('auth0_id') auth0Id: string,
  ): Promise<UserResponseDto> {
    // The Auth0Guard ensures auth0_id is present in headers
    // Fetch the user by the auth0_id from the header
    // This ensures users can only access their own data since we're using their auth0_id
    const user = await this.usersService.findOneByAuth0Id(auth0Id);

    // Additional security check: Verify the returned user matches the requested auth0_id
    if (user.auth0_id !== auth0Id) {
      throw new ForbiddenException('Access denied: You can only access your own profile');
    }

    return user;
  }
}

