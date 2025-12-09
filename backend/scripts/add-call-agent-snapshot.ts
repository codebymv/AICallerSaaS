// ============================================
// Add Agent Snapshot Fields to Call Table
// Run with: npx ts-node scripts/add-call-agent-snapshot.ts
// Uses raw SQL to avoid Prisma client sync issues
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding agent snapshot fields to Call table...\n');

  // Add the three new columns for agent snapshot
  const columns = [
    { name: 'agentName', type: 'VARCHAR(255)' },
    { name: 'agentVoice', type: 'VARCHAR(255)' },
    { name: 'agentVoiceProvider', type: 'VARCHAR(255)' },
  ];

  for (const column of columns) {
    try {
      // Check if column exists
      const checkResult = await prisma.$queryRaw<any[]>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Call' 
        AND column_name = ${column.name}
      `;

      if (checkResult.length === 0) {
        // Column doesn't exist, add it
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Call" ADD COLUMN "${column.name}" ${column.type}`
        );
        console.log(`✅ Added column: ${column.name}`);
      } else {
        console.log(`⏭️  Column already exists: ${column.name}`);
      }
    } catch (error) {
      console.error(`❌ Error adding column ${column.name}:`, error);
    }
  }

  // Backfill existing calls with agent data using raw SQL
  console.log('\nBackfilling existing calls with agent snapshot data...');
  
  try {
    // Use a single UPDATE with JOIN to backfill all calls at once
    const result = await prisma.$executeRaw`
      UPDATE "Call" c
      SET 
        "agentName" = a.name,
        "agentVoice" = a.voice,
        "agentVoiceProvider" = a."voiceProvider"
      FROM "Agent" a
      WHERE c."agentId" = a.id
      AND c."agentName" IS NULL
    `;

    console.log(`✅ Backfilled ${result} calls with agent snapshot data`);
  } catch (error) {
    console.error('❌ Error backfilling calls:', error);
  }

  console.log('\n✅ Agent snapshot migration complete!');
  console.log('\nNext steps:');
  console.log('1. Run: npx prisma generate');
  console.log('2. Deploy to Railway');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
