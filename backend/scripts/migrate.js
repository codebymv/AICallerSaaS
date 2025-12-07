// Simple migration script to add Twilio columns
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log('Connecting to database...');
  
  try {
    await client.connect();
    console.log('✓ Connected\n');

    console.log('Adding twilioAccountSid column...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioAccountSid" TEXT;
    `);
    console.log('✓ Done');

    console.log('Adding twilioAuthToken column...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioAuthToken" TEXT;
    `);
    console.log('✓ Done');

    console.log('Adding twilioConfigured column...');
    await client.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "twilioConfigured" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✓ Done\n');

    console.log('✅ All columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
