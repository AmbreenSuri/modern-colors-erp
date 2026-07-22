import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ALLOW_REPRINT_APPROVAL_KEY } from '../decorators/allow-reprint-approval.decorator';

/**
 * The reprint-approval permission — the THIRD named door through OVERSIGHT's
 * structural view-only guarantee (after corrections and user admin).
 *
 * Two-sided by design, exactly like the other two:
 *  - it passes ONLY for handlers explicitly marked @AllowReprintApproval() — attaching
 *    this guard to an unmarked route locks the route rather than opening it;
 *  - it passes ONLY the OVERSIGHT role.
 *
 * Why OVERSIGHT and not Store: Store is itself the main printer of raw-material
 * labels, so letting Store approve would make the commonest case self-approval, and
 * the lock would be decoration exactly where it is used most. OVERSIGHT prints no
 * finished-goods labels and does not run the label desk, so its approval is always a
 * genuine second pair of eyes.
 *
 * OVERSIGHT still appears in no mutating @Roles list anywhere (asserted by
 * label-reprint.spec.ts alongside the other doors), so the view-only rule stays
 * machine-checked; this guard is one named door through it.
 */
@Injectable()
export class ReprintApprovalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const marked = this.reflector.getAllAndOverride<boolean>(ALLOW_REPRINT_APPROVAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) {
      throw new ForbiddenException('This route is not a reprint-approval endpoint.');
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== Role.OVERSIGHT) {
      throw new ForbiddenException('Only the factory Admin may decide label reprint requests.');
    }
    return true;
  }
}
