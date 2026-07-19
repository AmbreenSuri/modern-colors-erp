import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MaterialStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

// The Phase 1 material-inward dashboard — read-only, for the Phase 1 roles plus the
// view-only Admin. The Phase 3 DISPATCH role is excluded: it must never see raw-material
// stock or PO data (enforced here server-side, not just hidden in the UI).
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPERATOR, Role.SUPERVISOR, Role.OVERSIGHT)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboard.summary();
  }

  @Get('search')
  search(
    @Query('status') status?: MaterialStatus,
    @Query('supplier') supplier?: string,
    @Query('poNumber') poNumber?: string,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.dashboard.search({
      status,
      supplier,
      poNumber,
      q,
      startDate,
      endDate,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
