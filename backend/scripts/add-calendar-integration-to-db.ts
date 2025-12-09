import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Calendar Integration to Database`);
  console.log(`========================================\n`);

  try {
    // Check if CalendarIntegration table exists
    console.log('Checking if CalendarIntegration table exists...');
    const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CalendarIntegration'
      ) as exists;
    `;

    if (!tableCheck[0].exists) {
      console.log('Creating CalendarIntegration table...');
      await prisma.$executeRaw`
        CREATE TABLE "CalendarIntegration" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "provider" TEXT NOT NULL DEFAULT 'calendly',
          "accessToken" TEXT NOT NULL,
          "refreshToken" TEXT,
          "expiresAt" TIMESTAMP(3),
          "calendlyUserUri" TEXT,
          "calendlyUserEmail" TEXT,
          "calendlyEventTypeUri" TEXT,
          "calendlyEventTypeName" TEXT,
          "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('✓ Created CalendarIntegration table');

      // Add unique constraint on userId (one calendar per user)
      console.log('Adding unique constraint on userId...');
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration" 
        ADD CONSTRAINT "CalendarIntegration_userId_key" UNIQUE ("userId");
      `;
      console.log('✓ Added unique constraint');

      // Add foreign key to User
      console.log('Adding foreign key to User...');
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration" 
        ADD CONSTRAINT "CalendarIntegration_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      console.log('✓ Added foreign key constraint');

      // Add index on userId for faster lookups
      console.log('Adding index on userId...');
      await prisma.$executeRaw`
        CREATE INDEX "CalendarIntegration_userId_idx" ON "CalendarIntegration"("userId");
      `;
      console.log('✓ Added userId index');

    } else {
      console.log('✓ CalendarIntegration table already exists');
      
      // Check and add any missing columns
      console.log('\nChecking for missing columns...');
      
      const columns = [
        { name: 'calendlyUserEmail', type: 'TEXT', default: null },
        { name: 'calendlyEventTypeName', type: 'TEXT', default: null },
        { name: 'timezone', type: 'TEXT NOT NULL', default: "'America/New_York'" },
        { name: 'isActive', type: 'BOOLEAN NOT NULL', default: 'true' },
      ];

      for (const col of columns) {
        const colCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'CalendarIntegration' AND column_name = ${col.name}
          ) as exists;
        `;
        
        if (!colCheck[0].exists) {
          console.log(`Adding ${col.name} column...`);
          if (col.default) {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "CalendarIntegration" 
              ADD COLUMN "${col.name}" ${col.type} DEFAULT ${col.default};
            `);
          } else {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "CalendarIntegration" 
              ADD COLUMN "${col.name}" ${col.type};
            `);
          }
          console.log(`✓ Added ${col.name} column`);
        } else {
          console.log(`✓ ${col.name} column already exists`);
        }
      }
    }

    // Verify table structure
    console.log('\n🧪 Verifying table structure...');
    const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CalendarIntegration'
      ORDER BY ordinal_position;
    `;
    
    console.log('CalendarIntegration table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Check for existing integrations
    const integrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "CalendarIntegration";
    `;
    console.log(`\nExisting calendar integrations: ${integrations[0].count}`);

    console.log(`\n✅ Database update completed successfully!\n`);

  } catch (error) {
    console.error(`❌ Error updating database:`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log(`Database connection closed\n`);
  }
}

updateDatabase()
  .then(() => {
    console.log('========================================');
    console.log('Calendar Integration schema update completed!');
    console.log('Now run: npx prisma generate');
    console.log('Then restart your server');
    console.log('========================================');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
