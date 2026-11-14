import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientCreditsException extends HttpException {
  constructor(required: number, available: number) {
    const shortfall = required - available;
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Insufficient Credits',
        message: `You need ${required.toFixed(2)} credits but only have ${available.toFixed(2)} available. Please purchase more credits.`,
        required: parseFloat(required.toFixed(2)),
        available: parseFloat(available.toFixed(2)),
        shortfall: parseFloat(shortfall.toFixed(2)),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
