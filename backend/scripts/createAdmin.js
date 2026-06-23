// scripts/createAdmin.js
// Upsert an ADMIN user with a known password (for local/dev only).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

(async function main() {
  const email = process.argv[2] || 'contact@dnrpestcontrol.in';
  const password = process.argv[3] || 'Nira@2000';
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hash,
        role: 'ADMIN',
        adminRole: 'SUPER_ADMIN',
        emailVerified: true,
        status: 'ACTIVE',
      },
      create: {
        email,
        fullName: 'Local Admin',
        passwordHash: hash,
        role: 'ADMIN',
        adminRole: 'SUPER_ADMIN',
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    console.log('Upserted admin:', user.email);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
