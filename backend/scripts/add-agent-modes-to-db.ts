import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Agent Modes to Database`);
  console.log(`========================================\n`);

  try {
    // Check if AgentMode enum exists
    console.log('Checking if AgentMode enum exists...');
    const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'AgentMode'
      ) as exists;
    `;
    
    if (!enumCheck[0].exists) {
      console.log('Creating AgentMode enum...');
      await prisma.$executeRaw`
        CREATE TYPE "AgentMode" AS ENUM ('INBOUND', 'OUTBOUND', 'HYBRID');
      `;
      console.log('✓ Created AgentMode enum');
    } else {
      console.log('✓ AgentMode enum already exists');
    }

    // Check if mode column exists
    console.log('\nChecking if mode column exists...');
    const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'mode'
      ) as exists;
    `;

    if (!columnCheck[0].exists) {
      console.log('Adding mode column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "mode" "AgentMode" NOT NULL DEFAULT 'INBOUND';
      `;
      console.log('✓ Added mode column');
    } else {
      console.log('✓ mode column already exists');
    }

    // Add outboundGreeting column
    console.log('\nAdding outboundGreeting column...');
    await prisma.$executeRaw`
      ALTER TABLE "Agent" 
      ADD COLUMN IF NOT EXISTS "outboundGreeting" TEXT;
    `;
    console.log('✓ Added/verified outboundGreeting column');

    // Add callTimeout column
    console.log('Adding callTimeout column...');
    await prisma.$executeRaw`
      ALTER TABLE "Agent" 
      ADD COLUMN IF NOT EXISTS "callTimeout" INTEGER NOT NULL DEFAULT 600;
    `;
    console.log('✓ Added/verified callTimeout column');

    // Add retryAttempts column
    console.log('Adding retryAttempts column...');
    await prisma.$executeRaw`
      ALTER TABLE "Agent" 
      ADD COLUMN IF NOT EXISTS "retryAttempts" INTEGER NOT NULL DEFAULT 0;
    `;
    console.log('✓ Added/verified retryAttempts column');

    // Add callWindowStart column
    console.log('Adding callWindowStart column...');
    await prisma.$executeRaw`
      ALTER TABLE "Agent" 
      ADD COLUMN IF NOT EXISTS "callWindowStart" TEXT;
    `;
    console.log('✓ Added/verified callWindowStart column');

    // Add callWindowEnd column
    console.log('Adding callWindowEnd column...');
    await prisma.$executeRaw`
      ALTER TABLE "Agent" 
      ADD COLUMN IF NOT EXISTS "callWindowEnd" TEXT;
    `;
    console.log('✓ Added/verified callWindowEnd column');

    // Verify changes
    console.log('\n🧪 Verifying changes...');
    const agents = await prisma.$queryRaw<Array<any>>`
      SELECT id, name, mode, "callTimeout", "retryAttempts" 
      FROM "Agent" 
      LIMIT 5;
    `;
    
    console.log(`Found ${agents.length} agents with mode field:`);
    agents.forEach(agent => {
      console.log(`  - ${agent.name}: mode=${agent.mode}, callTimeout=${agent.callTimeout}, retryAttempts=${agent.retryAttempts}`);
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

updateDatabase()
  .then(() => {
    console.log('========================================');
    console.log('Schema update completed!');
    console.log('Now run: npx prisma generate');
    console.log('Then restart your server');
    console.log('========================================');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
