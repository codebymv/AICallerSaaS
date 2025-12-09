import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding calendarEnabled to Agent Table`);
  console.log(`========================================\n`);

  try {
    // Check if calendarEnabled column exists
    console.log('Checking if calendarEnabled column exists...');
    const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'calendarEnabled'
      ) as exists;
    `;

    if (!columnCheck[0].exists) {
      console.log('Adding calendarEnabled column to Agent table...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "calendarEnabled" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('✓ Added calendarEnabled column (default: false)');
    } else {
      console.log('✓ calendarEnabled column already exists');
    }

    // Verify the column was added
    console.log('\nVerifying Agent table structure...');
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; column_default: string | null }>>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Agent' 
      AND column_name = 'calendarEnabled';
    `;

    if (columns.length > 0) {
      console.log('\nAgent calendarEnabled column:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
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
