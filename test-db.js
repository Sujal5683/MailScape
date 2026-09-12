const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.hduiptkkpqhfcgneusyh:Sujal%40645482@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
    }
  }
});
async function main() {
  try {
    const accounts = await prisma.accountConnection.findMany();
    console.log('Accounts (6543 no pgbouncer):', accounts.length);
  } catch (error) {
    console.error('Prisma Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
