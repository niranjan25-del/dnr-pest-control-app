// scripts/checkUser.js
// Quick script to inspect the admin user record in the current backend DB.
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

(async function main() {
  const email = process.argv[2] || 'contact@dnrpestcontrol.in';
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      console.log(JSON.stringify({ found: false, email }, null, 2));
      return;
    }
    console.log(JSON.stringify({
      found: true,
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      emailVerified: user.emailVerified,
      passwordHashPresent: !!user.passwordHash,
      passwordHashPreview: user.passwordHash ? user.passwordHash.slice(0, 10) + '...' : null,
    }, null, 2));
  } catch (err) {
    console.error('Error querying user:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
