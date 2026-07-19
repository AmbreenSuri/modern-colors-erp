import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { BatchService } from './batch.service';
import { CreateBatchDto } from './dto/create-batch.dto';

// Heads manage their OWN department's batches; Store and Admin can read all (they need
// the batch context on the request inbox and for traceability). Dispatch gets nothing
// here — it only ever sees finished goods.
const READ_ROLES = [Role.PRODUCTION_HEAD, Role.ADMIN, Role.OVERSIGHT] as const;

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchController {
  constructor(private readonly batches: BatchService) {}

  // Start a new batch — production head only, forced to their own department.
  @Post()
  @Roles(Role.PRODUCTION_HEAD)
  create(@Body() dto: CreateBatchDto, @CurrentUser() user: AuthUser) {
    return this.batches.create(user, dto);
  }

  // Picker list: a head sees only their department's batches, newest first, each with
  // status + accumulated totals so they can top-up an existing batch safely.
  @Get()
  @Roles(...READ_ROLES)
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('take') take?: string,
  ) {
    return this.batches.list(user, { search, take: take ? Number(take) : undefined });
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.batches.findOne(user, id);
  }

  /**
   * Full traceability chain for a batch — what raw material went in (down to the unit,
   * PO and supplier) and what finished goods came out (down to dispatch state).
   */
  @Get(':id/trace')
  @Roles(...READ_ROLES)
  trace(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.batches.trace(user, id);
  }
}
