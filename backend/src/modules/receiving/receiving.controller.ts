import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ReceivingService } from './receiving.service';
import { ScanDto, WeightDto } from './dto/receiving.dto';

// Receiving actions are Operator (and Admin). Idempotent for offline re-sync (I9).
@Controller('receiving')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPERATOR)
export class ReceivingController {
  constructor(private readonly receiving: ReceivingService) {}

  @Post('scan')
  scan(@Body() dto: ScanDto, @CurrentUser() actor: AuthUser) {
    return this.receiving.scan(dto.uniqueId, actor.id, dto.device);
  }

  @Post(':uniqueId/weight')
  weigh(
    @Param('uniqueId') uniqueId: string,
    @Body() dto: WeightDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.receiving.weigh(uniqueId, dto.weight, actor.id, dto.device);
  }
}
