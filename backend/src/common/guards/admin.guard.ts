import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isAdminEmail } from '../admin-access';

/**
 * Allows only users whose email is listed in ADMIN_EMAILS (comma-separated).
 * Runs after the global JWT guard, so request.user is already set.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { email?: string } }>();
    if (!isAdminEmail(user?.email)) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
