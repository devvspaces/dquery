import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './constants/queue-names';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.DOMAIN_GENERATION,
      },
      {
        name: QUEUE_NAMES.DOMAIN_CHECKING,
      },
      {
        name: QUEUE_NAMES.PRICE_SYNC,
      },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.DOMAIN_GENERATION,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.DOMAIN_CHECKING,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_NAMES.PRICE_SYNC,
      adapter: BullMQAdapter,
    }),
  ],
})
export class BullBoardConfigModule {}
