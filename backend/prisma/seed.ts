/**
 * Seeds the initial Admin user from env (SEED_ADMIN_*). Idempotent: only creates
 * the admin when the users table is empty, so re-running never clobbers real users.
 * Run: npm run seed
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@moderncolours.local';
  const name = process.env.SEED_ADMIN_NAME ?? 'Factory Admin';
  // No default password — refuse to seed a known/guessable bootstrap credential.
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is required (min 8 chars). Set it in backend/.env before seeding.',
    );
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    const existing = await prisma.user.findUnique({ where: { email } });
    console.log(
      `Seed skipped: ${userCount} user(s) already exist.` +
        (existing ? ` Admin "${email}" present.` : ''),
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { email, name, role: Role.ADMIN, active: true, passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      entityType: 'User',
      entityId: admin.id,
      action: 'SEED_ADMIN_CREATED',
      actorId: admin.id,
      afterJson: { email: admin.email, role: admin.role },
    },
  });

  console.log(`✅ Seeded initial Admin: ${email}`);
  console.log('   Change this password after first login.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
