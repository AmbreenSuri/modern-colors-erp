/**
 * Phase 2 — one-time (idempotent) role/login setup.
 *
 * Seeds the 5 Phase 2 logins. Admin does NOT manage users in-app; run this script to
 * provision or repair the logins. Safe to re-run any number of times.
 *
 *   - Store    : the EXISTING admin@moderncolours.local login. Only its display name is
 *                set to "Store" — role (ADMIN) and PASSWORD/credentials are NEVER changed.
 *   - Admin    : NEW factory-wide VIEW-ONLY login (role OVERSIGHT).
 *   - PU / Enamel / Powder heads : NEW department-scoped logins (role PRODUCTION_HEAD).
 *
 * Passwords for the 4 NEW logins default to ChangeMe123! (override via SEED_PHASE2_PASSWORD).
 * On re-run, existing users are NEVER re-credentialed — only role/department/name/active
 * are reconciled — so a password an operator later changes is preserved.
 *
 * Run: npm run seed:phase2
 */
import { PrismaClient, Role, Department } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

const STORE_EMAIL = process.env.STORE_EMAIL ?? 'admin@moderncolours.local';
const PW = process.env.SEED_PHASE2_PASSWORD ?? 'ChangeMe123!';

interface NewLogin {
  email: string;
  name: string;
  role: Role;
  department: Department | null;
}

const NEW_LOGINS: NewLogin[] = [
  {
    email: process.env.SEED_OVERSIGHT_EMAIL ?? 'oversight@moderncolours.local',
    name: 'Admin',
    role: Role.OVERSIGHT,
    department: null,
  },
  {
    email: process.env.SEED_PU_EMAIL ?? 'pu@moderncolours.local',
    name: 'PU Production Head',
    role: Role.PRODUCTION_HEAD,
    department: Department.PU,
  },
  {
    email: process.env.SEED_ENAMEL_EMAIL ?? 'enamel@moderncolours.local',
    name: 'Enamel Production Head',
    role: Role.PRODUCTION_HEAD,
    department: Department.ENAMEL,
  },
  {
    email: process.env.SEED_POWDER_EMAIL ?? 'powder@moderncolours.local',
    name: 'Powder Production Head',
    role: Role.PRODUCTION_HEAD,
    department: Department.POWDER,
  },
];

async function audit(entityId: string, action: string, actorId: string | null, after: unknown) {
  await prisma.auditLog.create({
    data: { entityType: 'User', entityId, action, actorId, afterJson: after as object },
  });
}

async function main() {
  const summary: { email: string; role: string; department: string; note: string }[] = [];

  // ── 1. Store — relabel display name only; never touch role or credentials ──
  let store = await prisma.user.findUnique({ where: { email: STORE_EMAIL } });
  if (store) {
    // Relabel display name only. Never re-activate a deliberately-disabled account,
    // and never touch role or credentials — re-enabling must be an explicit admin action.
    if (store.name !== 'Store') {
      store = await prisma.user.update({
        where: { id: store.id },
        data: { name: 'Store' },
      });
      await audit(store.id, 'PHASE2_STORE_RELABELLED', store.id, { name: 'Store' });
      summary.push({ email: STORE_EMAIL, role: store.role, department: '—', note: 'relabelled → "Store"' });
    } else {
      summary.push({ email: STORE_EMAIL, role: store.role, department: '—', note: 'already "Store" (unchanged)' });
    }
  } else {
    // Never auto-create the powerful ADMIN "Store" here (that would provision an admin
    // with a known default password). The Phase 1 seed owns Store creation with a proper
    // SEED_ADMIN_PASSWORD — require it to exist first.
    throw new Error(
      `Store login "${STORE_EMAIL}" not found. Run the Phase 1 seed first ` +
        `(npm run seed, with SEED_ADMIN_PASSWORD set), then re-run this script.`,
    );
  }
  const actorId = store.id;

  // ── 2. The 4 new logins — create if absent; reconcile role/dept/name if present ──
  for (const login of NEW_LOGINS) {
    const existing = await prisma.user.findUnique({ where: { email: login.email } });
    if (existing) {
      // Reconcile role/dept/name only. Do NOT re-credential and do NOT re-activate a
      // deactivated account (re-enabling must be a deliberate admin action, not a
      // side effect of re-running setup — avoids auth-bypass via state drift).
      const needsFix =
        existing.role !== login.role ||
        existing.department !== login.department ||
        existing.name !== login.name;
      if (needsFix) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: login.role, department: login.department, name: login.name },
        });
        await audit(existing.id, 'PHASE2_USER_RECONCILED', actorId, {
          role: login.role,
          department: login.department,
        });
      }
      summary.push({
        email: login.email,
        role: login.role,
        department: login.department ?? '—',
        note: needsFix ? 'reconciled (password kept)' : 'already correct (unchanged)',
      });
    } else {
      const created = await prisma.user.create({
        data: {
          email: login.email,
          name: login.name,
          role: login.role,
          department: login.department,
          passwordHash: await bcrypt.hash(PW, BCRYPT_ROUNDS),
          active: true,
        },
      });
      await audit(created.id, 'PHASE2_USER_CREATED', actorId, {
        email: login.email,
        role: login.role,
        department: login.department,
      });
      summary.push({
        email: login.email,
        role: login.role,
        department: login.department ?? '—',
        note: 'created (uses the setup password)',
      });
    }
  }

  console.log('\n✅ Phase 2 role setup complete:\n');
  console.table(summary);
  // Do NOT echo the password to stdout (terminal history / CI logs). Newly-created
  // logins use SEED_PHASE2_PASSWORD (default ChangeMe123!, documented in the header).
  console.log(
    '\nNewly-created logins use the configured setup password until changed. The Store login keeps its existing credentials.\n',
  );
}

main()
  .catch((e) => {
    console.error('Phase 2 role setup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
