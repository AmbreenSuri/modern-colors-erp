import { SetMetadata } from '@nestjs/common';

export const ALLOW_REPRINT_APPROVAL_KEY = 'allowReprintApproval';

/**
 * The THIRD named door through OVERSIGHT's structural view-only rule (after
 * @AllowCorrection and @AllowUserAdmin): deciding label reprint requests.
 *
 * Same discipline — a separate mechanism from @Roles, so "OVERSIGHT appears in no
 * mutating @Roles list" stays true and machine-checked, enforced by a two-sided guard
 * that refuses unmarked handlers even for OVERSIGHT.
 *
 * Deliberately narrow: this grants approving and rejecting a reprint, and NOTHING
 * about printing. The factory Admin never gains the ability to mint a QR, and the
 * reprint itself is still performed by whoever holds the printing role.
 *
 * label-reprint.spec.ts asserts this marker exists ONLY on the approval controller, so
 * the door cannot silently widen.
 */
export const AllowReprintApproval = () => SetMetadata(ALLOW_REPRINT_APPROVAL_KEY, true);
