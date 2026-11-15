import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Allows only users whose email is listed in ADMIN_EMAILS (comma-separated).
 * Runs after the global JWT guard, so request.user is already set.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const admins = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { email?: string } }>();
    const email = user?.email?.toLowerCase();
    if (!email || !admins.includes(email)) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
