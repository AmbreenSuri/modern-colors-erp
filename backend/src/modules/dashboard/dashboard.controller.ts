import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MaterialStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

// Dashboard is read-only — available to all authenticated roles (incl. Supervisor).
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
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
