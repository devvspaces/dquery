import { Module } from '@nestjs/common';
import { NamegenController } from './namegen.controller';
import { NamegenService } from './namegen.service';

@Module({
  controllers: [NamegenController],
  providers: [NamegenService],
  exports: [NamegenService],
})
export class NamegenModule {}
