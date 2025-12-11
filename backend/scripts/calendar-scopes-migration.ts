/**
 * Migration: Agent-Centric Calendar Scopes
 * 
 * Changes:
 * 1. Removes agentId column from CalendarIntegration (calendar no longer owns agent assignment)
 * 2. Adds new calendar config columns to Agent (agent now owns calendar configuration)
 * 
 * Run with: npx ts-node scripts/calendar-scopes-migration.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running Agent-Centric Calendar Scopes Migration...\n');

  try {
    // ============================================
    // Step 1: Add new columns to Agent table
    // ============================================
    console.log('Step 1: Adding calendar config columns to Agent table...');
    
    // Add calendarIntegrationId
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN IF NOT EXISTS "calendarIntegrationId" TEXT
      `;
      console.log('  ✅ Added calendarIntegrationId column');
    } catch (e) {
      console.log('  ℹ️ calendarIntegrationId column may already exist');
    }

    // Add calendarScopes (array)
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN IF NOT EXISTS "calendarScopes" TEXT[] DEFAULT ARRAY['read_calendar', 'create_events', 'reschedule_events']::TEXT[]
      `;
      console.log('  ✅ Added calendarScopes column with defaults');
    } catch (e) {
      console.log('  ℹ️ calendarScopes column may already exist');
    }

    // Add defaultEventTypeId
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN IF NOT EXISTS "defaultEventTypeId" TEXT
      `;
      console.log('  ✅ Added defaultEventTypeId column');
    } catch (e) {
      console.log('  ℹ️ defaultEventTypeId column may already exist');
    }

    // Add defaultEventTypeName
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN IF NOT EXISTS "defaultEventTypeName" TEXT
      `;
      console.log('  ✅ Added defaultEventTypeName column');
    } catch (e) {
      console.log('  ℹ️ defaultEventTypeName column may already exist');
    }

    // Add defaultEventDuration
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN IF NOT EXISTS "defaultEventDuration" INTEGER DEFAULT 30
      `;
      console.log('  ✅ Added defaultEventDuration column');
    } catch (e) {
      console.log('  ℹ️ defaultEventDuration column may already exist');
    }

    // Add foreign key constraint for calendarIntegrationId
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Agent"
        ADD CONSTRAINT "Agent_calendarIntegrationId_fkey"
        FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('  ✅ Added foreign key constraint');
    } catch (e: any) {
      if (e.code === '42710') {
        console.log('  ℹ️ Foreign key constraint already exists');
      } else {
        console.log('  ℹ️ Foreign key constraint may already exist or failed:', e.message);
      }
    }

    // Add index for performance
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Agent_calendarIntegrationId_idx" 
        ON "Agent"("calendarIntegrationId")
      `;
      console.log('  ✅ Added index on calendarIntegrationId');
    } catch (e) {
      console.log('  ℹ️ Index may already exist');
    }

    // ============================================
    // Step 2: Remove agentId from CalendarIntegration
    // ============================================
    console.log('\nStep 2: Removing agentId from CalendarIntegration...');

    // Drop foreign key constraint first
    try {
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration"
        DROP CONSTRAINT IF EXISTS "CalendarIntegration_agentId_fkey"
      `;
      console.log('  ✅ Dropped agentId foreign key constraint');
    } catch (e) {
      console.log('  ℹ️ Foreign key constraint may not exist');
    }

    // Drop index
    try {
      await prisma.$executeRaw`
        DROP INDEX IF EXISTS "CalendarIntegration_agentId_idx"
      `;
      console.log('  ✅ Dropped agentId index');
    } catch (e) {
      console.log('  ℹ️ Index may not exist');
    }

    // Drop the column
    try {
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration"
        DROP COLUMN IF EXISTS "agentId"
      `;
      console.log('  ✅ Dropped agentId column');
    } catch (e) {
      console.log('  ℹ️ agentId column may not exist');
    }

    // ============================================
    // Step 3: Verify changes
    // ============================================
    console.log('\nStep 3: Verifying changes...');

    // Check Agent columns
    const agentColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Agent' 
      AND column_name IN ('calendarIntegrationId', 'calendarScopes', 'defaultEventTypeId', 'defaultEventTypeName', 'defaultEventDuration')
    `;
    console.log('  Agent calendar columns:', agentColumns.map(c => c.column_name));

    // Check CalendarIntegration columns (should not have agentId)
    const calendarColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CalendarIntegration' 
      AND column_name = 'agentId'
    `;
    console.log('  CalendarIntegration agentId exists:', calendarColumns.length > 0 ? 'YES (should be removed)' : 'NO (correct!)');

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

