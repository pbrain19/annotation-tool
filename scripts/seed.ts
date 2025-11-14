import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('nexusnomical2026', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'miguel@expert.micro1.ai' },
    update: {},
    create: {
      username: 'miguel@expert.micro1.ai',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Created admin user:', { username: admin.username, role: admin.role });

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDefault credentials:');
  console.log('  Admin: username=miguel@expert.micro1.ai, password=nexusnomical2026');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
