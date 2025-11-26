import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class Auth0Guard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth0Id = request.headers['auth0_id'] || request.headers['auth0-id'];

    if (!auth0Id) {
      throw new UnauthorizedException('auth0_id header is required');
    }

    // Store the auth0_id in the request for use in the controller
    request.userAuth0Id = auth0Id;

    return true;
  }
}

