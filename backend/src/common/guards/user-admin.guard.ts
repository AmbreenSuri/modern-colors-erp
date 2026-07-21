import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ALLOW_USER_ADMIN_KEY } from '../decorators/allow-user-admin.decorator';

/**
 * User-management permission for the factory Admin (OVERSIGHT). Two-sided like
 * CorrectionsGuard: an unmarked handler is refused even for OVERSIGHT (attaching this
 * guard locks a route, never opens it), and marked handlers pass ONLY OVERSIGHT.
 */
@Injectable()
export class UserAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const marked = this.reflector.getAllAndOverride<boolean>(ALLOW_USER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!marked) {
      throw new ForbiddenException('This route is not a user-management endpoint.');
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== Role.OVERSIGHT) {
      throw new ForbiddenException('Only the factory Admin may manage logins.');
    }
    return true;
  }
}
