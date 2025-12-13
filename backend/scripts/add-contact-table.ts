import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Contact Table`);
  console.log(`========================================\n`);

  try {
    // ============ CHECK IF TABLE EXISTS ============
    console.log('--- Checking for Contact table ---\n');

    const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Contact'
      ) as exists;
    `;

    if (!tableCheck[0].exists) {
      console.log('Creating Contact table...');
      
      // Create the table
      await prisma.$executeRaw`
        CREATE TABLE "Contact" (
          "id" TEXT NOT NULL,
          "phoneNumber" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "notes" TEXT,
          "userId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,

          CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('✓ Created Contact table');

      // Add foreign key constraint
      console.log('Adding foreign key constraint...');
      await prisma.$executeRaw`
        ALTER TABLE "Contact" 
        ADD CONSTRAINT "Contact_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      console.log('✓ Added foreign key constraint');

      // Create unique constraint
      console.log('Creating unique constraint...');
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "Contact_userId_phoneNumber_key" 
        ON "Contact"("userId", "phoneNumber");
      `;
      console.log('✓ Created unique constraint on userId + phoneNumber');

      // Create indexes
      console.log('Creating indexes...');
      await prisma.$executeRaw`
        CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "Contact_phoneNumber_idx" ON "Contact"("phoneNumber");
      `;
      console.log('✓ Created indexes');

    } else {
      console.log('✓ Contact table already exists');
    }

    // ============ VERIFICATION ============
    console.log('\n--- Verifying Changes ---\n');

    // Verify table structure
    const columns = await prisma.$queryRaw<Array<{ 
      column_name: string; 
      data_type: string; 
      is_nullable: string;
      column_default: string | null;
    }>>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Contact'
      ORDER BY ordinal_position;
    `;

    console.log('Contact table columns:');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` (default: ${col.column_default})` : '';
      console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });

    // Verify indexes
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Contact'
      ORDER BY indexname;
    `;

    console.log('\nContact table indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

    // Verify constraints
    const constraints = await prisma.$queryRaw<Array<{ 
      constraint_name: string;
      constraint_type: string;
    }>>`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'Contact'
      ORDER BY constraint_name;
    `;

    console.log('\nContact table constraints:');
    constraints.forEach(con => {
      console.log(`  - ${con.constraint_name} (${con.constraint_type})`);
    });

    console.log('\n========================================');
    console.log('Database update complete!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error updating database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDatabase()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });


