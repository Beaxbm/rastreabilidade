import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@gauge.com' },
    update: {},
    create: {
      email: 'admin@gauge.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  console.log('👤 Admin user created:', admin.email);

  // Create operator user
  const operatorPassword = await bcrypt.hash('operator123', 12);
  
  const operator = await prisma.user.upsert({
    where: { email: 'operator@gauge.com' },
    update: {},
    create: {
      email: 'operator@gauge.com',
      name: 'Operador',
      password: operatorPassword,
      role: 'OPERATOR'
    }
  });

  console.log('👤 Operator user created:', operator.email);

  console.log('✅ Database seeded successfully!');
  console.log('📝 Login credentials:');
  console.log('   Admin: admin@gauge.com / admin123');
  console.log('   Operator: operator@gauge.com / operator123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });