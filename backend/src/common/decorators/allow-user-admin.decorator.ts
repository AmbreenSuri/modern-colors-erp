import { SetMetadata } from '@nestjs/common';

export const ALLOW_USER_ADMIN_KEY = 'allowUserAdmin';

/**
 * The SECOND named door through OVERSIGHT's structural view-only rule (the first is
 * @AllowCorrection): user management. Same discipline — a separate mechanism from
 * @Roles so "OVERSIGHT appears in no mutating @Roles list" stays true and
 * machine-checked, enforced by a two-sided guard that refuses unmarked handlers.
 *
 * The isolation spec (user-admin.spec.ts) asserts this marker exists ONLY on
 * UserAdminController, so the door cannot silently widen.
 */
export const AllowUserAdmin = () => SetMetadata(ALLOW_USER_ADMIN_KEY, true);
