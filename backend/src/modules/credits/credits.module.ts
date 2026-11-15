import { Module } from '@nestjs/common';
import { CommandModule } from 'nestjs-command';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditsGuard } from './guards/credits.guard';
import { CreditsCommand } from './credits.command';
import { CreditPricingService } from './credit-pricing.service';

@Module({
  imports: [CommandModule],
  controllers: [CreditsController],
  providers: [
    CreditsService,
    CreditPricingService,
    CreditsGuard,
    CreditsCommand,
  ],
  exports: [CreditsService, CreditPricingService, CreditsGuard],
})
export class CreditsModule {}
