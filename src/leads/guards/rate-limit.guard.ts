import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const now = Date.now();
    const timestamps = (this.requests.get(ip) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );

    if (timestamps.length >= MAX_REQUESTS) {
      throw new HttpException(
        { error: 'Too many requests. Please try again in a minute.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? 'unknown';
  }
}
