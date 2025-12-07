// Check and add Twilio columns to User table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking User table columns...\n');

  try {
    // First, check what columns exist
    const columns = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      ORDER BY ordinal_position;
    `);

    console.log('Current columns in User table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    const hasAccountSid = columns.some(c => c.column_name === 'twilioAccountSid');
    const hasAuthToken = columns.some(c => c.column_name === 'twilioAuthToken');
    const hasConfigured = columns.some(c => c.column_name === 'twilioConfigured');

    console.log('\n📊 Twilio columns status:');
    console.log(`  - twilioAccountSid: ${hasAccountSid ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  - twilioAuthToken: ${hasAuthToken ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`  - twilioConfigured: ${hasConfigured ? '✓ EXISTS' : '✗ MISSING'}`);

    if (!hasAccountSid || !hasAuthToken || !hasConfigured) {
      console.log('\n🔄 Adding missing columns...\n');

      if (!hasAccountSid) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "twilioAccountSid" TEXT;`);
        console.log('✓ Added twilioAccountSid');
      }

      if (!hasAuthToken) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "twilioAuthToken" TEXT;`);
        console.log('✓ Added twilioAuthToken');
      }

      if (!hasConfigured) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "twilioConfigured" BOOLEAN NOT NULL DEFAULT false;`);
        console.log('✓ Added twilioConfigured');
      }

      console.log('\n✅ Migration completed!');
    } else {
      console.log('\n✅ All Twilio columns already exist!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

