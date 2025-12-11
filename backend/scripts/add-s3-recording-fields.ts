/**
 * Migration: Add S3 Recording Fields to Call
 * 
 * Adds recordingStorageKey and recordingStorageProvider fields to Call table.
 * 
 * Run with: npx ts-node scripts/add-s3-recording-fields.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running S3 Recording Fields Migration...\n');

  try {
    // ============================================
    // Step 1: Add new columns to Call table
    // ============================================
    console.log('Step 1: Adding S3 storage columns to Call table...');
    
    // Add recordingStorageKey
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Call" 
        ADD COLUMN IF NOT EXISTS "recordingStorageKey" TEXT
      `;
      console.log('  ✅ Added recordingStorageKey column');
    } catch (e) {
      console.log('  ℹ️ recordingStorageKey column may already exist');
    }

    // Add recordingStorageProvider
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Call" 
        ADD COLUMN IF NOT EXISTS "recordingStorageProvider" TEXT
      `;
      console.log('  ✅ Added recordingStorageProvider column');
    } catch (e) {
      console.log('  ℹ️ recordingStorageProvider column may already exist');
    }

    // ============================================
    // Step 2: Set default provider for existing recordings
    // ============================================
    console.log('\nStep 2: Setting default provider for existing recordings...');

    const result = await prisma.$executeRaw`
      UPDATE "Call"
      SET "recordingStorageProvider" = 'twilio'
      WHERE "recordingUrl" IS NOT NULL
      AND "recordingStorageProvider" IS NULL
    `;
    console.log(`  ✅ Updated ${result} existing recordings to use Twilio provider`);

    // ============================================
    // Step 3: Verify changes
    // ============================================
    console.log('\nStep 3: Verifying changes...');

    // Check Call columns
    const callColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Call' 
      AND column_name IN ('recordingStorageKey', 'recordingStorageProvider')
    `;
    console.log('  Call storage columns:', callColumns.map(c => c.column_name));

    // Check stats
    const stats = await prisma.$queryRaw<Array<{ total: bigint, with_recording: bigint, with_s3: bigint }>>`
      SELECT 
        COUNT(*) as total,
        COUNT("recordingUrl") as with_recording,
        COUNT(CASE WHEN "recordingStorageProvider" = 's3' THEN 1 END) as with_s3
      FROM "Call"
    `;
    console.log(`  Total calls: ${stats[0].total}`);
    console.log(`  Calls with recording: ${stats[0].with_recording}`);
    console.log(`  Calls with S3 recording: ${stats[0].with_s3}`);

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Set environment variables:');
    console.log('   - AWS_ACCESS_KEY_ID');
    console.log('   - AWS_SECRET_ACCESS_KEY');
    console.log('   - AWS_REGION (default: us-east-1)');
    console.log('   - AWS_S3_BUCKET');
    console.log('3. Restart your backend server');
    console.log('4. New recordings will automatically be uploaded to S3');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
