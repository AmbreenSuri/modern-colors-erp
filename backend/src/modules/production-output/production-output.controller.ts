import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ProductionOutputService } from './production-output.service';
import { CreateOutputDto, UpdateOutputDto } from './dto/create-output.dto';

// Recording and confirming output is the production head's job. Store/Admin can READ
// (traceability + oversight) but never record or confirm. Dispatch gets nothing here.
const READ_ROLES = [Role.PRODUCTION_HEAD, Role.ADMIN, Role.OVERSIGHT] as const;

@Controller('production-outputs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionOutputController {
  constructor(private readonly outputs: ProductionOutputService) {}

  @Post()
  @Roles(Role.PRODUCTION_HEAD)
  create(@Body() dto: CreateOutputDto, @CurrentUser() user: AuthUser) {
    return this.outputs.create(user, dto);
  }

  @Get()
  @Roles(...READ_ROLES)
  list(
    @CurrentUser() user: AuthUser,
    @Query('batchId') batchId?: string,
    @Query('confirmed') confirmed?: string,
  ) {
    return this.outputs.list(user, {
      batchId,
      confirmed: confirmed === undefined ? undefined : confirmed === 'true',
    });
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.outputs.findOne(user, id);
  }

  @Patch(':id')
  @Roles(Role.PRODUCTION_HEAD)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOutputDto) {
    return this.outputs.update(user, id, dto);
  }

  // THE REVIEW GATE — nothing is final (and no FG QR can be minted) until this runs.
  @Post(':id/confirm')
  @Roles(Role.PRODUCTION_HEAD)
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.outputs.confirm(user, id);
  }

  @Delete(':id')
  @Roles(Role.PRODUCTION_HEAD)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.outputs.remove(user, id);
  }
}
