import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService], // dashboard/reports (Step 8) reuse the movement data
})
export class StockModule {}
