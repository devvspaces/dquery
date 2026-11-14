import { SetMetadata } from '@nestjs/common';

export const REQUIRED_CREDITS_KEY = 'requiredCredits';
export const RequiredCredits = (amount: number) =>
  SetMetadata(REQUIRED_CREDITS_KEY, amount);
