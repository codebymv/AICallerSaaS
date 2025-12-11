import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding Google Calendar fields to CalendarIntegration table...\n');

  try {
    // Add Google Calendar columns
    console.log('Step 1: Adding googleAccessToken column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "googleAccessToken" TEXT;
    `;
    console.log('✅ googleAccessToken column added\n');

    console.log('Step 2: Adding googleRefreshToken column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;
    `;
    console.log('✅ googleRefreshToken column added\n');

    console.log('Step 3: Adding googleTokenExpiry column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "googleTokenExpiry" TIMESTAMP(3);
    `;
    console.log('✅ googleTokenExpiry column added\n');

    console.log('Step 4: Adding googleCalendarId column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
    `;
    console.log('✅ googleCalendarId column added\n');

    console.log('Step 5: Adding googleUserEmail column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "googleUserEmail" TEXT;
    `;
    console.log('✅ googleUserEmail column added\n');

    // Verify columns were added
    console.log('Verifying columns...');
    const result: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CalendarIntegration'
      AND column_name IN ('googleAccessToken', 'googleRefreshToken', 'googleTokenExpiry', 'googleCalendarId', 'googleUserEmail')
      ORDER BY column_name;
    `;

    console.log('\n📊 New columns:');
    result.forEach((col) => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your backend server');
    console.log('3. Configure Google OAuth in Google Cloud Console');
  } catch (error) {
    console.error('❌ Migration failed:', error);
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

