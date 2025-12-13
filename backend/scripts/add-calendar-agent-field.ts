/**
 * Migration: Add agentId field to CalendarIntegration
 * 
 * Run with: npx ts-node scripts/add-calendar-agent-field.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Adding agentId field to CalendarIntegration...\n');

  try {
    // Check if column already exists
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CalendarIntegration' AND column_name = 'agentId'
    `;

    if (columns.length > 0) {
      console.log('✅ agentId column already exists');
    } else {
      // Add the agentId column
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration" 
        ADD COLUMN IF NOT EXISTS "agentId" TEXT
      `;
      console.log('✅ Added agentId column');

      // Add foreign key constraint
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration"
        ADD CONSTRAINT "CalendarIntegration_agentId_fkey"
        FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
      `;
      console.log('✅ Added foreign key constraint');

      // Add index for performance
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "CalendarIntegration_agentId_idx" 
        ON "CalendarIntegration"("agentId")
      `;
      console.log('✅ Added index on agentId');
    }

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


