import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackProvider } from './providers/paystack.provider';

@Module({
  imports: [CreditsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackProvider],
})
export class PaymentsModule {}
