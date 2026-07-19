import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService], // production-output + traceability reuse it
})
export class BatchModule {}
