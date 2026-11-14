import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../../database/schema';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Type helper for better type inference (optional, but recommended)
export type CurrentUserType = User;
