import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { MaterialService } from './material.service';
import { MaterialController } from './material.controller';

@Module({
  imports: [QrModule],
  controllers: [MaterialController],
  providers: [MaterialService],
  exports: [MaterialService],
})
export class MaterialModule {}
