/**
 * Migration: Add agentName and agentVoice to Conversation
 * 
 * Adds denormalized agent info fields to preserve agent data when agents are deleted.
 * 
 * Run with: npx ts-node scripts/conversation-agent-fields-migration.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running Conversation Agent Fields Migration...\n');

  try {
    // ============================================
    // Step 1: Add new columns to Conversation table
    // ============================================
    console.log('Step 1: Adding agentName and agentVoice columns to Conversation table...');
    
    // Add agentName
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Conversation" 
        ADD COLUMN IF NOT EXISTS "agentName" TEXT
      `;
      console.log('  ✅ Added agentName column');
    } catch (e) {
      console.log('  ℹ️ agentName column may already exist');
    }

    // Add agentVoice
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Conversation" 
        ADD COLUMN IF NOT EXISTS "agentVoice" TEXT
      `;
      console.log('  ✅ Added agentVoice column');
    } catch (e) {
      console.log('  ℹ️ agentVoice column may already exist');
    }

    // ============================================
    // Step 2: Backfill existing conversations with agent data
    // ============================================
    console.log('\nStep 2: Backfilling existing conversations with agent data...');

    const result = await prisma.$executeRaw`
      UPDATE "Conversation" c
      SET 
        "agentName" = a.name,
        "agentVoice" = a.voice
      FROM "Agent" a
      WHERE c."agentId" = a.id
      AND (c."agentName" IS NULL OR c."agentVoice" IS NULL)
    `;
    console.log(`  ✅ Updated ${result} conversations with agent data`);

    // ============================================
    // Step 3: Verify changes
    // ============================================
    console.log('\nStep 3: Verifying changes...');

    // Check Conversation columns
    const conversationColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Conversation' 
      AND column_name IN ('agentName', 'agentVoice')
    `;
    console.log('  Conversation agent columns:', conversationColumns.map(c => c.column_name));

    // Check how many conversations have agent data
    const stats = await prisma.$queryRaw<Array<{ total: bigint, with_name: bigint }>>`
      SELECT 
        COUNT(*) as total,
        COUNT("agentName") as with_name
      FROM "Conversation"
    `;
    console.log(`  Total conversations: ${stats[0].total}`);
    console.log(`  Conversations with agentName: ${stats[0].with_name}`);

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your backend server');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

