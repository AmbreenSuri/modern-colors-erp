import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { StockService } from './stock.service';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';

// Stock movement is a Store-only action (the sole scanner/issuer). The view-only
// Admin reads history through the dashboard endpoints (Step 8), not here.
@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** QR-verify / look up a scanned unit before choosing a movement. */
  @Get('units/:uniqueId')
  getUnit(@Param('uniqueId') uniqueId: string) {
    return this.stock.getUnit(uniqueId);
  }

  /** A unit's append-only movement history. */
  @Get('units/:uniqueId/transactions')
  unitTransactions(@Param('uniqueId') uniqueId: string) {
    return this.stock.unitTransactions(uniqueId);
  }

  /** Record one Add / Deduct / Discard on a scanned unit. */
  @Post('transactions')
  create(@Body() dto: CreateStockTransactionDto, @CurrentUser() user: AuthUser) {
    return this.stock.createTransaction(user, dto);
  }
}
