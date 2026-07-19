/**
 * Phase 3 — seed the single DISPATCH login.
 *
 * Idempotent and non-destructive:
 *  - creates dispatch@moderncolours.local if missing
 *  - if it already exists, leaves it completely alone (no password reset, no
 *    re-activation) so a live account is never silently changed by a re-run
 *  - never logs the password
 *
 * Password defaults to ChangeMe123! — override with SEED_PHASE3_PASSWORD.
 * Run:  npx tsx prisma/seed-phase3-dispatch.ts
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PW = process.env.SEED_PHASE3_PASSWORD ?? 'ChangeMe123!';
const BCRYPT_ROUNDS = 10;

const DISPATCH_EMAIL = 'dispatch@moderncolours.local';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DISPATCH_EMAIL } });

  if (existing) {
    console.log(`• ${DISPATCH_EMAIL} already exists (role ${existing.role}) — left untouched.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: DISPATCH_EMAIL,
      name: 'Dispatch',
      role: Role.DISPATCH,
      department: null, // dispatch ships every department's finished goods
      passwordHash: await bcrypt.hash(PW, BCRYPT_ROUNDS),
      active: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: 'User',
      entityId: user.id,
      action: 'USER_SEEDED',
      afterJson: { email: user.email, role: user.role },
    },
  });

  console.log(`✓ Created ${DISPATCH_EMAIL} (DISPATCH).`);
  console.log('  Password: set via SEED_PHASE3_PASSWORD (default ChangeMe123!). Change it after first login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
