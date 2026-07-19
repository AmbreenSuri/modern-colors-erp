import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { FinishedGoodsController } from './finished-goods.controller';
import { MaterialController } from '../material/material.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { CatalogueController } from '../catalogue/catalogue.controller';
import { PurchaseOrderController } from '../purchase-order/purchase-order.controller';
import { StockController } from '../stock/stock.controller';
import { ProductionRequestController } from '../production-request/production-request.controller';
import { BatchController } from '../batch/batch.controller';
import { ProductionOutputController } from '../production-output/production-output.controller';
import { AnalyticsController } from '../analytics/analytics.controller';

/**
 * Phase 3 role isolation, asserted from the actual @Roles metadata rather than by
 * reading the code. The DISPATCH login must reach finished-goods/dispatch routes ONLY —
 * never raw material, stock, requests, POs, batches, output or Phase 1 dashboards.
 */
describe('Phase 3 — DISPATCH role isolation (server-side)', () => {
  const reflector = new Reflector();

  /** Effective roles for a route = method-level @Roles, else class-level. */
  function rolesFor(controller: any, method: string): Role[] | undefined {
    return reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      controller.prototype[method],
      controller,
    ]);
  }

  /** Every public route handler on a controller. */
  function methodsOf(controller: any): string[] {
    return Object.getOwnPropertyNames(controller.prototype).filter(
      (m) => m !== 'constructor' && typeof controller.prototype[m] === 'function',
    );
  }

  const FORBIDDEN_FOR_DISPATCH: [string, any][] = [
    ['MaterialController', MaterialController],
    ['DashboardController', DashboardController],
    ['CatalogueController', CatalogueController],
    ['PurchaseOrderController', PurchaseOrderController],
    ['StockController', StockController],
    ['ProductionRequestController', ProductionRequestController],
    ['BatchController', BatchController],
    ['ProductionOutputController', ProductionOutputController],
    ['AnalyticsController', AnalyticsController],
  ];

  describe.each(FORBIDDEN_FOR_DISPATCH)('%s', (_name, controller) => {
    it('has a role gate on EVERY route (no ungated endpoint)', () => {
      for (const m of methodsOf(controller)) {
        const roles = rolesFor(controller, m);
        expect(roles && roles.length > 0).toBe(true);
      }
    });

    it('never grants DISPATCH', () => {
      for (const m of methodsOf(controller)) {
        const roles = rolesFor(controller, m) ?? [];
        expect(roles).not.toContain(Role.DISPATCH);
      }
    });
  });

  describe('FinishedGoodsController', () => {
    it('gates every route', () => {
      for (const m of methodsOf(FinishedGoodsController)) {
        const roles = rolesFor(FinishedGoodsController, m);
        expect(roles && roles.length > 0).toBe(true);
      }
    });

    it('restricts the dispatch ACTIONS to DISPATCH only', () => {
      for (const m of ['scan', 'bulk']) {
        expect(rolesFor(FinishedGoodsController, m)).toEqual([Role.DISPATCH]);
      }
    });

    it('lets DISPATCH read the ready list, history, unit lookup and FG list', () => {
      for (const m of ['ready', 'history', 'unit', 'list']) {
        expect(rolesFor(FinishedGoodsController, m)).toContain(Role.DISPATCH);
      }
    });

    it('does NOT let DISPATCH generate FG QR codes or print labels', () => {
      expect(rolesFor(FinishedGoodsController, 'generate')).not.toContain(Role.DISPATCH);
      expect(rolesFor(FinishedGoodsController, 'labels')).not.toContain(Role.DISPATCH);
    });

    it('restricts FG generation to the production head', () => {
      expect(rolesFor(FinishedGoodsController, 'generate')).toEqual([Role.PRODUCTION_HEAD]);
    });
  });

  describe('production output confirm gate', () => {
    it('only a production head may record or confirm output', () => {
      for (const m of ['create', 'confirm', 'update', 'remove']) {
        expect(rolesFor(ProductionOutputController, m)).toEqual([Role.PRODUCTION_HEAD]);
      }
    });
  });

  describe('batch creation', () => {
    it('only a production head may create a batch', () => {
      expect(rolesFor(BatchController, 'create')).toEqual([Role.PRODUCTION_HEAD]);
    });
  });
});
