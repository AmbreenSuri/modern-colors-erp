import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LabelReprintService } from './label-reprint.service';
import { LabelReprintController, LabelReprintApprovalController } from './label-reprint.controller';

/**
 * The label reprint lock. Exported so the material and finished-goods modules can
 * enforce it inside their existing print paths — the reprint goes through the SAME
 * renderer as the first print, never a copy of it.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [LabelReprintController, LabelReprintApprovalController],
  providers: [LabelReprintService],
  exports: [LabelReprintService],
})
export class LabelReprintModule {}
