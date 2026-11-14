import { Module } from '@nestjs/common';
import { CommandModule } from 'nestjs-command';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditsGuard } from './guards/credits.guard';
import { CreditsCommand } from './credits.command';

@Module({
  imports: [CommandModule],
  controllers: [CreditsController],
  providers: [CreditsService, CreditsGuard, CreditsCommand],
  exports: [CreditsService, CreditsGuard],
})
export class CreditsModule {}
