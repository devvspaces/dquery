import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsString, MaxLength } from 'class-validator';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../database/schema';

class CheckoutDto {
  @IsString()
  @MaxLength(30)
  packId: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** GET /api/credits/packs: packs and prices in the checkout currency. */
  @Public()
  @Get('credits/packs')
  packs() {
    return this.payments.listPacks();
  }

  /** POST /api/payments/checkout: returns a hosted checkout URL. */
  @Post('payments/checkout')
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: User) {
    return this.payments.createCheckout(user, dto.packId);
  }

  /** GET /api/payments/:reference: status of one of the user's payments. */
  @Get('payments/:reference')
  status(@Param('reference') reference: string, @CurrentUser() user: User) {
    return this.payments.getPurchase(user.id, reference);
  }

  /** POST /api/payments/paystack/webhook: signed by Paystack; always 200 once handled. */
  @Public()
  @Post('payments/paystack/webhook')
  @HttpCode(200)
  async paystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, unknown>,
  ) {
    await this.payments.handleWebhook(req.rawBody, headers);
    return { received: true };
  }
}
