import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates requests via the 'jwt' passport strategy.
 * Apply globally or per-controller; pair with RolesGuard for RBAC.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
