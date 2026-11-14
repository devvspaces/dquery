import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CreditsService } from '../credits.service';
import { REQUIRED_CREDITS_KEY } from '../decorators/required-credits.decorator';
import { InsufficientCreditsException } from '../exceptions/insufficient-credits.exception';

@Injectable()
export class CreditsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private creditsService: CreditsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required credits from decorator metadata
    const requiredCredits = this.reflector.getAllAndOverride<number>(
      REQUIRED_CREDITS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no required credits specified, allow the request
    if (!requiredCredits) {
      return true;
    }

    // Get user from request (populated by JWT auth guard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      return false;
    }

    // Check if user has sufficient credits
    const balance = await this.creditsService.getBalance(user.id);

    if (balance.balance < requiredCredits) {
      throw new InsufficientCreditsException(requiredCredits, balance.balance);
    }

    // Store required credits in request for potential use in controller
    request.requiredCredits = requiredCredits;

    return true;
  }
}
