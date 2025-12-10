import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Business Profile Fields`);
  console.log(`========================================\n`);

  try {
    // ============ USER TABLE - Business Profile Fields ============
    console.log('--- User Table: Business Profile Fields ---\n');

    // organizationName
    const orgNameCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'organizationName'
      ) as exists;
    `;

    if (!orgNameCheck[0].exists) {
      console.log('Adding organizationName column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "organizationName" TEXT;
      `;
      console.log('✓ Added organizationName column');
    } else {
      console.log('✓ organizationName column already exists');
    }

    // industry
    const industryCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'industry'
      ) as exists;
    `;

    if (!industryCheck[0].exists) {
      console.log('Adding industry column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "industry" TEXT;
      `;
      console.log('✓ Added industry column');
    } else {
      console.log('✓ industry column already exists');
    }

    // businessDescription
    const bizDescCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'businessDescription'
      ) as exists;
    `;

    if (!bizDescCheck[0].exists) {
      console.log('Adding businessDescription column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "businessDescription" TEXT;
      `;
      console.log('✓ Added businessDescription column');
    } else {
      console.log('✓ businessDescription column already exists');
    }

    // businessProfileComplete
    const bizCompleteCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'businessProfileComplete'
      ) as exists;
    `;

    if (!bizCompleteCheck[0].exists) {
      console.log('Adding businessProfileComplete column to User table...');
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "businessProfileComplete" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('✓ Added businessProfileComplete column (default: false)');
    } else {
      console.log('✓ businessProfileComplete column already exists');
    }

    // ============ AGENT TABLE - Business Context Fields ============
    console.log('\n--- Agent Table: Business Context Fields ---\n');

    // personaName
    const personaNameCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'personaName'
      ) as exists;
    `;

    if (!personaNameCheck[0].exists) {
      console.log('Adding personaName column to Agent table...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "personaName" TEXT;
      `;
      console.log('✓ Added personaName column');
    } else {
      console.log('✓ personaName column already exists');
    }

    // callPurpose
    const callPurposeCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'callPurpose'
      ) as exists;
    `;

    if (!callPurposeCheck[0].exists) {
      console.log('Adding callPurpose column to Agent table...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "callPurpose" TEXT;
      `;
      console.log('✓ Added callPurpose column');
    } else {
      console.log('✓ callPurpose column already exists');
    }

    // ============ VERIFICATION ============
    console.log('\n--- Verifying Changes ---\n');

    // Verify User columns
    const userColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; column_default: string | null }>>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('organizationName', 'industry', 'businessDescription', 'businessProfileComplete')
      ORDER BY column_name;
    `;

    console.log('User Business Profile columns:');
    userColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
    });

    // Verify Agent columns
    const agentColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; column_default: string | null }>>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Agent' 
      AND column_name IN ('personaName', 'callPurpose')
      ORDER BY column_name;
    `;

    console.log('\nAgent Business Context columns:');
    agentColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'NULL'})`);
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
