import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCalComIntegration() {
  console.log(`\n========================================`);
  console.log(`Adding Cal.com Integration Fields to Database`);
  console.log(`========================================\n`);

  try {
    // Add calcomApiKey column
    console.log('Adding calcomApiKey column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomApiKey" TEXT;
    `;
    console.log('✓ Added/verified calcomApiKey column');

    // Add calcomUserId column
    console.log('Adding calcomUserId column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomUserId" INTEGER;
    `;
    console.log('✓ Added/verified calcomUserId column');

    // Add calcomUsername column
    console.log('Adding calcomUsername column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomUsername" TEXT;
    `;
    console.log('✓ Added/verified calcomUsername column');

    // Add calcomUserEmail column
    console.log('Adding calcomUserEmail column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomUserEmail" TEXT;
    `;
    console.log('✓ Added/verified calcomUserEmail column');

    // Add calcomEventTypeId column
    console.log('Adding calcomEventTypeId column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomEventTypeId" INTEGER;
    `;
    console.log('✓ Added/verified calcomEventTypeId column');

    // Add calcomEventTypeSlug column
    console.log('Adding calcomEventTypeSlug column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomEventTypeSlug" TEXT;
    `;
    console.log('✓ Added/verified calcomEventTypeSlug column');

    // Add calcomEventTypeName column
    console.log('Adding calcomEventTypeName column...');
    await prisma.$executeRaw`
      ALTER TABLE "CalendarIntegration" 
      ADD COLUMN IF NOT EXISTS "calcomEventTypeName" TEXT;
    `;
    console.log('✓ Added/verified calcomEventTypeName column');

    // Verify changes
    console.log('\n🧪 Verifying changes...');
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CalendarIntegration' 
      AND column_name LIKE 'calcom%'
      ORDER BY column_name;
    `;
    
    console.log(`Found ${columns.length} Cal.com columns:`);
    columns.forEach(col => {
      console.log(`  - ${col.column_name}`);
    });

    // Check existing integrations
    const integrations = await prisma.$queryRaw<Array<{ id: string; provider: string; userId: string }>>`
      SELECT id, provider, "userId" FROM "CalendarIntegration" LIMIT 5;
    `;
    
    console.log(`\nExisting integrations: ${integrations.length}`);
    integrations.forEach(int => {
      console.log(`  - ${int.id}: provider=${int.provider}`);
    });

    console.log(`\n✅ Database update completed successfully!\n`);

  } catch (error) {
    console.error(`❌ Error updating database:`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log(`Database connection closed\n`);
  }
}

addCalComIntegration()
  .then(() => {
    console.log('========================================');
    console.log('Cal.com schema update completed!');
    console.log('Now run: npx prisma generate');
    console.log('Then restart your server');
    console.log('========================================');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
