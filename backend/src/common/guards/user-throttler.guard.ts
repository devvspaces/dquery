import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits per signed-in user. Behind nginx every request comes from
 * 127.0.0.1, so the default IP-based key would throttle everyone together.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return (req.user?.id as string | undefined) ?? (req.ip as string) ?? 'anon';
  }
}
