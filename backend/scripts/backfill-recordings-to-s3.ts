/**
 * Backfill Script: Migrate Existing Twilio Recordings to S3
 * 
 * This script downloads existing call recordings from Twilio and uploads them to S3.
 * 
 * Run with: npx ts-node scripts/backfill-recordings-to-s3.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import { 
  uploadFromUrl, 
  generateRecordingKey,
  isS3Configured 
} from '../src/services/storage.service';
import { logger } from '../src/utils/logger';

declare const process: any;

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Recording Backfill to S3...\n');

  // Check S3 configuration
  if (!isS3Configured()) {
    console.error('❌ S3 is not configured!');
    console.error('Please set the following environment variables:');
    console.error('  - AWS_ACCESS_KEY_ID');
    console.error('  - AWS_SECRET_ACCESS_KEY');
    console.error('  - AWS_S3_BUCKET');
    console.error('  - AWS_REGION');
    process.exit(1);
  }

  try {
    // Find all calls with Twilio recordings that haven't been migrated to S3
    const callsToMigrate = await prisma.call.findMany({
      where: {
        recordingUrl: { not: null },
        OR: [
          { recordingStorageProvider: null },
          { recordingStorageProvider: 'twilio' },
          { recordingStorageProvider: { not: 's3' } },
        ],
      },
      select: {
        id: true,
        callSid: true,
        userId: true,
        recordingUrl: true,
        recordingStorageKey: true,
        recordingStorageProvider: true,
      },
    });

    console.log(`Found ${callsToMigrate.length} recordings to migrate\n`);

    if (callsToMigrate.length === 0) {
      console.log('✅ No recordings to migrate. All recordings are already in S3!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ callSid: string; error: string }> = [];

    // Create Twilio auth header
    const twilioAuth = 'Basic ' + Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');

    // Process each recording
    for (let i = 0; i < callsToMigrate.length; i++) {
      const call = callsToMigrate[i];
      const progress = `[${i + 1}/${callsToMigrate.length}]`;

      console.log(`${progress} Migrating recording for call ${call.callSid}...`);

      try {
        // Skip if already has S3 key (shouldn't happen, but safety check)
        if (call.recordingStorageKey && call.recordingStorageProvider === 's3') {
          console.log(`  ⏭️  Already in S3, skipping`);
          successCount++;
          continue;
        }

        // Generate S3 key
        const storageKey = generateRecordingKey(call.userId, call.callSid);
        
        // The Twilio recording URL needs .mp3 appended
        const recordingUrlWithFormat = `${call.recordingUrl}.mp3`;

        // Upload to S3
        const result = await uploadFromUrl(
          recordingUrlWithFormat,
          storageKey,
          'audio/mpeg',
          twilioAuth
        );

        // Update database
        await prisma.call.update({
          where: { id: call.id },
          data: {
            recordingStorageKey: result.key,
            recordingStorageProvider: 's3',
          },
        });

        console.log(`  ✅ Uploaded to S3: ${result.key} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        errorCount++;
        const errorMsg = error.message || 'Unknown error';
        errors.push({ callSid: call.callSid, error: errorMsg });
        console.error(`  ❌ Failed: ${errorMsg}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log(`  Total recordings: ${callsToMigrate.length}`);
    console.log(`  ✅ Successfully migrated: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(({ callSid, error }) => {
        console.log(`  - ${callSid}: ${error}`);
      });
    }

    console.log('\n✅ Backfill complete!');
    console.log('\nNote: Original Twilio recordings remain accessible as fallback.');

  } catch (error) {
    console.error('Backfill failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

