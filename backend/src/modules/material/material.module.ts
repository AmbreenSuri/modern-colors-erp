import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { LabelReprintModule } from '../label-reprint/label-reprint.module';
import { MaterialService } from './material.service';
import { MaterialController } from './material.controller';

@Module({
  imports: [QrModule, LabelReprintModule],
  controllers: [MaterialController],
  providers: [MaterialService],
  exports: [MaterialService],
})
export class MaterialModule {}
