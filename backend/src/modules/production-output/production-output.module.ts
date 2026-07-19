import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ProductionOutputController } from './production-output.controller';
import { ProductionOutputService } from './production-output.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ProductionOutputController],
  providers: [ProductionOutputService],
  exports: [ProductionOutputService],
})
export class ProductionOutputModule {}
