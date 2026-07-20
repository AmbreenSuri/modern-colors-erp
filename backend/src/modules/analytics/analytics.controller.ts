import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { DispatchAnalyticsService } from './dispatch-analytics.service';


/**
 * Parse the Company Brain date range.
 *
 * Defaults to the last 30 days. Invalid or reversed inputs fall back to the default
 * rather than throwing — a mistyped date in a URL should not 500 the owner's dashboard.
 * `to` is pushed to end-of-day so "today" includes everything that happened today.
 */
function parseRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(Date.now() - 29 * 864e5);
  const valid = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());
  if (!valid(start) || !valid(end) || start > end) {
    const fallbackEnd = new Date();
    const fallbackStart = new Date(Date.now() - 29 * 864e5);
    fallbackStart.setHours(0, 0, 0, 0);
    return { start: fallbackStart, end: fallbackEnd };
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly dispatchAnalytics: DispatchAnalyticsService,
  ) {}

  /**
   * Dispatch analytics.
   *
   * DISPATCH sees it because it is their own dashboard; OVERSIGHT sees it because
   * dispatch throughput is part of the factory-wide picture. Both get the SAME numbers
   * from the same service, so the owner's view and the worker's view can never disagree.
   *
   * The service queries finished goods only — no raw-material stock, no requests, no
   * Phase 1 data — so the isolation holds at the data layer, not just in the UI.
   */
  @Get('dispatch')
  @Roles(Role.DISPATCH, Role.OVERSIGHT)
  dispatchOverview(@Query('days') days?: string, @Query('department') department?: string) {
    const dept = department as never;
    return this.dispatchAnalytics.overview(days ? Number(days) : undefined, dept || undefined);
  }

  /**
   * The factory-wide flow ("Company Brain") — the owner's view, ADMIN ONLY.
   *
   * Spans raw material in through to dispatch, so it is deliberately NOT available to
   * DISPATCH or the production heads: it would cross every isolation boundary the rest
   * of the system maintains.
   */
  @Get('flow')
  @Roles(Role.OVERSIGHT)
  flow(@Query('from') from?: string, @Query('to') to?: string) {
    const { start, end } = parseRange(from, to);
    return this.dispatchAnalytics.flow(start, end);
  }

  // Factory-wide oversight analytics — Admin only (view-only role).
  @Get('overview')
  @Roles(Role.OVERSIGHT)
  adminOverview(@Query('days') days?: string) {
    return this.analytics.adminOverview(days ? Number(days) : undefined);
  }

  // Store dashboard analytics — Store only.
  @Get('store')
  @Roles(Role.ADMIN)
  storeOverview(@Query('days') days?: string) {
    return this.analytics.storeOverview(days ? Number(days) : undefined);
  }

  // Production-head dashboard — scoped SERVER-SIDE to the caller's own department.
  // A head can never obtain another department's numbers here.
  @Get('my')
  @Roles(Role.PRODUCTION_HEAD)
  myOverview(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    return this.analytics.myOverview(user, days ? Number(days) : undefined);
  }
}
