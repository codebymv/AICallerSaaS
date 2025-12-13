import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log('\n========================================');
  console.log('Adding billingPeriodStart to User table');
  console.log('========================================\n');

  try {
    console.log('Checking if billingPeriodStart column exists...');
    const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'billingPeriodStart'
      ) as exists;
    `;

    if (!columnCheck[0]?.exists) {
      console.log('Adding billingPeriodStart column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "billingPeriodStart" TIMESTAMP(3);
      `;
      console.log('✓ Added billingPeriodStart column');
    } else {
      console.log('✓ billingPeriodStart column already exists');
    }

    console.log('\nVerifying User table structure...');
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
    >`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'billingPeriodStart';
    `;

    if (columns.length > 0) {
      console.log('\nUser billingPeriodStart column:');
      columns.forEach(col => {
        console.log(
          `  - ${col.column_name}: ${col.data_type} ${col.is_nullable} default: ${col.column_default}`
        );
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

updateDatabase().catch(error => {
  console.error(error);
  process.exit(1);
});

