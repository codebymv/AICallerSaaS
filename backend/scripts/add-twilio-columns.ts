// Migration script to add Twilio columns to User table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Adding Twilio columns to User table...');

  try {
    // Add twilioAccountSid column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioAccountSid" TEXT;
    `);
    console.log('✓ Added twilioAccountSid column');

    // Add twilioAuthToken column
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioAuthToken" TEXT;
    `);
    console.log('✓ Added twilioAuthToken column');

    // Add twilioConfigured column with default false
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioConfigured" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✓ Added twilioConfigured column');

    console.log('\n✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
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


