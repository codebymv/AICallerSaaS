import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding twilioMessagingServiceSid to User Table`);
  console.log(`========================================\n`);

  try {
    // Check if twilioMessagingServiceSid column exists
    console.log('Checking if twilioMessagingServiceSid column exists...');
    const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'twilioMessagingServiceSid'
      ) as exists;
    `;

    if (!columnCheck[0].exists) {
      console.log('Adding twilioMessagingServiceSid column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "twilioMessagingServiceSid" TEXT;
      `;
      console.log('✓ Added twilioMessagingServiceSid column (nullable)');
    } else {
      console.log('✓ twilioMessagingServiceSid column already exists');
    }

    // Verify the column was added
    console.log('\nVerifying User table structure...');
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'twilioMessagingServiceSid';
    `;

    if (columns.length > 0) {
      console.log('\nUser twilioMessagingServiceSid column:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    console.log('\n========================================');
    console.log('Database update complete!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Database update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDatabase()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
