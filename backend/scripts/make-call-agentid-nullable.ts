// ============================================
// Make Call.agentId Nullable
// Run with: npx ts-node scripts/make-call-agentid-nullable.ts
// This allows calls to be preserved when agents are deleted
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Making Call.agentId nullable to preserve call history...\n');

  try {
    // First, ensure all existing calls have their snapshot fields populated
    console.log('Step 1: Backfilling agent snapshot data for existing calls...');
    
    const backfillResult = await prisma.$executeRaw`
      UPDATE "Call" c
      SET 
        "agentName" = a.name,
        "agentVoice" = a.voice,
        "agentVoiceProvider" = a."voiceProvider"
      FROM "Agent" a
      WHERE c."agentId" = a.id
      AND c."agentName" IS NULL
    `;
    
    console.log(`✅ Backfilled ${backfillResult} calls with agent snapshot data`);

    // Now make the agentId column nullable
    console.log('\nStep 2: Making agentId column nullable...');
    
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Call" ALTER COLUMN "agentId" DROP NOT NULL
      `);
      console.log('✅ agentId column is now nullable');
    } catch (e: any) {
      if (e.message?.includes('already nullable')) {
        console.log('⏭️  agentId is already nullable');
      } else {
        throw e;
      }
    }

    // Update the foreign key constraint to SET NULL on delete
    console.log('\nStep 3: Updating foreign key constraint to SET NULL on delete...');
    
    // Drop the existing constraint
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Call" DROP CONSTRAINT IF EXISTS "Call_agentId_fkey"
      `);
      console.log('✅ Dropped existing foreign key constraint');
    } catch (e) {
      console.log('⏭️  No existing constraint to drop or already handled');
    }

    // Add the new constraint with ON DELETE SET NULL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Call" 
      ADD CONSTRAINT "Call_agentId_fkey" 
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
    
    console.log('✅ Added new foreign key constraint with ON DELETE SET NULL');

    // Verify the change
    const columnInfo = await prisma.$queryRaw<any[]>`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Call' 
      AND column_name = 'agentId'
    `;
    
    if (columnInfo.length > 0) {
      console.log(`\n📊 Column status: agentId is_nullable = ${columnInfo[0].is_nullable}`);
    }

    console.log('\n✅ Migration complete!');
    console.log('\nCall history will now be preserved when agents are deleted.');
    console.log('The agent snapshot fields (agentName, agentVoice, agentVoiceProvider) will be used to display deleted agent info.');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your backend server');

  } catch (error: any) {
    if (error.message?.includes('already nullable') || error.code === '42601') {
      console.log('⏭️  agentId is already nullable, skipping...');
    } else {
      throw error;
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


