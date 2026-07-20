import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StorageService } from './common/storage/storage.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';

/**
 * Liveness endpoint for the host's health checks. Deliberately PUBLIC and
 * deliberately empty of detail: the platform polls it constantly and must be able to
 * reach it before any auth exists.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'modern-colours-api', time: new Date().toISOString() };
  }
}

/**
 * Storage diagnostics — AUTHENTICATED, admin-only.
 *
 * Split into its own controller so the public liveness route above cannot accidentally
 * inherit these guards, and so this one cannot accidentally lose them.
 *
 * This was briefly public when first shipped, which was wrong on two counts:
 *  1. It disclosed the R2 endpoint host — which embeds the Cloudflare ACCOUNT ID —
 *     plus the bucket name and which environment variables are missing. That is
 *     infrastructure reconnaissance: not a credential, but a meaningful head start for
 *     anyone targeting the storage account or social-engineering its support.
 *  2. The deep probe WRITES an object on every call. Unauthenticated, that is a free
 *     write/cost amplifier against the client's own R2 bill.
 *
 * Whoever diagnoses a storage outage is an operator with a login, so requiring auth
 * costs the workflow nothing.
 */
@Controller('health/storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OVERSIGHT)
export class StorageHealthController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Deep check opt-in via ?deep=1, because it performs a real write/read/compare
   * round-trip. That round-trip is the only check that proves credentials, bucket and
   * permissions all genuinely work — the question a "500 on upload" incident needs
   * answered in seconds rather than hours.
   *
   * Credentials are never returned; the probe reports configuration state only.
   */
  @Get()
  async storageHealth(@Query('deep') deep?: string) {
    if (deep === '1' || deep === 'true') {
      const result = await this.storage.healthCheck();
      return { status: result.ok ? 'ok' : 'degraded', storage: result };
    }
    return {
      status: 'ok',
      hint: 'Add ?deep=1 to run a real write/read round-trip against the storage backend.',
    };
  }
}
