import pkg from './src/generated/prisma/index.js';

const { PrismaClient } = pkg;

try {
  const prisma = new PrismaClient({ log: ['query'] });
  await prisma.user.findMany();
  console.log('connected');
  await prisma.$disconnect();
} catch (err) {
  console.error(err);
}
