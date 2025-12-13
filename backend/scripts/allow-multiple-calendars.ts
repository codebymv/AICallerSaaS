/**
 * Migration: Allow Multiple Calendar Integrations Per User
 * 
 * Changes:
 * 1. Removes the UNIQUE constraint on userId in CalendarIntegration
 * 2. Adds a compound UNIQUE constraint on (userId, provider)
 * 
 * This allows users to connect multiple calendar providers (Google, Cal.com, Calendly)
 * while preventing duplicate connections to the same provider.
 * 
 * Run with: npx ts-node scripts/allow-multiple-calendars.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating CalendarIntegration to allow multiple calendars per user...\n');

  try {
    // Step 1: Check current state
    console.log('Step 1: Checking current constraints...');
    const existingConstraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'CalendarIntegration' 
      AND constraint_type = 'UNIQUE'
    `;
    console.log('Existing unique constraints:', existingConstraints);

    // Step 2: Drop the unique constraint on userId if it exists
    console.log('\nStep 2: Removing unique constraint on userId...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "CalendarIntegration" 
        DROP CONSTRAINT IF EXISTS "CalendarIntegration_userId_key"
      `;
      console.log('✅ Dropped userId unique constraint');
    } catch (e) {
      console.log('ℹ️ userId unique constraint may not exist or already dropped');
    }

    // Step 3: Add compound unique constraint on (userId, provider)
    console.log('\nStep 3: Adding compound unique constraint on (userId, provider)...');
    try {
      // First check if it already exists
      const existingCompound = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'CalendarIntegration' 
        AND constraint_name = 'CalendarIntegration_userId_provider_key'
      `;
      
      if (existingCompound.length === 0) {
        await prisma.$executeRaw`
          ALTER TABLE "CalendarIntegration" 
          ADD CONSTRAINT "CalendarIntegration_userId_provider_key" 
          UNIQUE ("userId", "provider")
        `;
        console.log('✅ Added compound unique constraint on (userId, provider)');
      } else {
        console.log('ℹ️ Compound unique constraint already exists');
      }
    } catch (e: any) {
      if (e.code === '23505') {
        console.log('⚠️ Cannot add constraint - duplicate entries exist. Please clean up data first.');
      } else {
        throw e;
      }
    }

    // Step 4: Verify the changes
    console.log('\nStep 4: Verifying changes...');
    const finalConstraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'CalendarIntegration' 
      AND constraint_type = 'UNIQUE'
    `;
    console.log('Final unique constraints:', finalConstraints);

    // Step 5: Show current calendar integrations
    const integrations = await prisma.calendarIntegration.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        calendlyUserEmail: true,
        calcomUserEmail: true,
        googleUserEmail: true,
      }
    });
    console.log(`\n📊 Current calendar integrations: ${integrations.length}`);
    integrations.forEach(i => {
      const email = i.calendlyUserEmail || i.calcomUserEmail || i.googleUserEmail || 'N/A';
      console.log(`  - ${i.provider}: ${email} (user: ${i.userId.substring(0, 8)}...)`);
    });

    console.log('\n✅ Migration complete!');
    console.log('\nUsers can now connect multiple calendar providers.');
    console.log('Each provider type can only be connected once per user.');
    console.log('\nNext steps:');
    console.log('1. Update Prisma schema to reflect changes');
    console.log('2. Run: npx prisma generate');
    console.log('3. Restart your backend server');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);


