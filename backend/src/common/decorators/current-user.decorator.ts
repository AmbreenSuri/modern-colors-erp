import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, Department } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  department: Department | null; // Phase 2 — set only for PRODUCTION_HEAD
}

/**
 * Injects the authenticated user (populated by JwtStrategy.validate) into a handler.
 * Example: foo(@CurrentUser() user: AuthUser) {}
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
