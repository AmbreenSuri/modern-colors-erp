import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { QrModule } from '../qr/qr.module';
import { FinishedGoodsController } from './finished-goods.controller';
import { FinishedGoodsService } from './finished-goods.service';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [PrismaModule, AuditModule, QrModule],
  controllers: [FinishedGoodsController],
  providers: [FinishedGoodsService, DispatchService],
  exports: [FinishedGoodsService, DispatchService],
})
export class FinishedGoodsModule {}
