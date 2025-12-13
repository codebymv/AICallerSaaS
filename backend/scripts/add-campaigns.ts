import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Campaigns Feature`);
  console.log(`========================================\n`);

  try {
    // 1. Create CampaignStatus enum
    console.log('Creating CampaignStatus enum...');
    const campaignStatusExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'CampaignStatus'
      ) as exists;
    `;

    if (!campaignStatusExists[0].exists) {
      await prisma.$executeRaw`
        CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
      `;
      console.log('✓ Created CampaignStatus enum');
    } else {
      console.log('✓ CampaignStatus enum already exists');
    }

    // 2. Create LeadStatus enum
    console.log('Creating LeadStatus enum...');
    const leadStatusExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'LeadStatus'
      ) as exists;
    `;

    if (!leadStatusExists[0].exists) {
      await prisma.$executeRaw`
        CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'SCHEDULED', 'CALLING', 'COMPLETED', 'FAILED', 'SKIPPED');
      `;
      console.log('✓ Created LeadStatus enum');
    } else {
      console.log('✓ LeadStatus enum already exists');
    }

    // 3. Create Campaign table
    console.log('Creating Campaign table...');
    const campaignTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Campaign'
      ) as exists;
    `;

    if (!campaignTableExists[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "Campaign" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "agentId" TEXT NOT NULL,
          "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
          "startDate" TIMESTAMP(3),
          "endDate" TIMESTAMP(3),
          "callWindowStart" TEXT,
          "callWindowEnd" TEXT,
          "dailyCallLimit" INTEGER NOT NULL DEFAULT 100,
          "callsPerHour" INTEGER,
          "minCallInterval" INTEGER NOT NULL DEFAULT 30,
          "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
          "retryInterval" INTEGER NOT NULL DEFAULT 3600,
          "totalLeads" INTEGER NOT NULL DEFAULT 0,
          "callsCompleted" INTEGER NOT NULL DEFAULT 0,
          "callsSuccessful" INTEGER NOT NULL DEFAULT 0,
          "callsFailed" INTEGER NOT NULL DEFAULT 0,
          "leadsContacted" INTEGER NOT NULL DEFAULT 0,
          "userId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,

          CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
        );
      `;

      await prisma.$executeRaw`
        CREATE INDEX "Campaign_userId_idx" ON "Campaign"("userId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "Campaign_agentId_idx" ON "Campaign"("agentId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "Campaign_startDate_idx" ON "Campaign"("startDate");
      `;

      await prisma.$executeRaw`
        ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      await prisma.$executeRaw`
        ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;

      console.log('✓ Created Campaign table with indexes and foreign keys');
    } else {
      console.log('✓ Campaign table already exists');
    }

    // 4. Create CampaignLead table
    console.log('Creating CampaignLead table...');
    const campaignLeadTableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CampaignLead'
      ) as exists;
    `;

    if (!campaignLeadTableExists[0].exists) {
      await prisma.$executeRaw`
        CREATE TABLE "CampaignLead" (
          "id" TEXT NOT NULL,
          "campaignId" TEXT NOT NULL,
          "name" TEXT,
          "phoneNumber" TEXT NOT NULL,
          "email" TEXT,
          "metadata" JSONB DEFAULT '{}',
          "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "lastAttemptAt" TIMESTAMP(3),
          "nextAttemptAt" TIMESTAMP(3),
          "lastCallId" TEXT,
          "lastCallDuration" INTEGER,
          "lastCallStatus" TEXT,
          "outcome" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,

          CONSTRAINT "CampaignLead_pkey" PRIMARY KEY ("id")
        );
      `;

      await prisma.$executeRaw`
        CREATE INDEX "CampaignLead_campaignId_idx" ON "CampaignLead"("campaignId");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "CampaignLead_status_idx" ON "CampaignLead"("status");
      `;
      await prisma.$executeRaw`
        CREATE INDEX "CampaignLead_nextAttemptAt_idx" ON "CampaignLead"("nextAttemptAt");
      `;
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX "CampaignLead_campaignId_phoneNumber_key" ON "CampaignLead"("campaignId", "phoneNumber");
      `;

      await prisma.$executeRaw`
        ALTER TABLE "CampaignLead" ADD CONSTRAINT "CampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;

      console.log('✓ Created CampaignLead table with indexes and foreign keys');
    } else {
      console.log('✓ CampaignLead table already exists');
    }

    // 5. Add campaignId and campaignLeadId to Call table
    console.log('Adding campaign fields to Call table...');
    
    const campaignIdExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Call' AND column_name = 'campaignId'
      ) as exists;
    `;

    if (!campaignIdExists[0].exists) {
      await prisma.$executeRaw`
        ALTER TABLE "Call" 
        ADD COLUMN "campaignId" TEXT,
        ADD COLUMN "campaignLeadId" TEXT;
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX "Call_campaignId_idx" ON "Call"("campaignId");
      `;

      console.log('✓ Added campaign fields to Call table');
    } else {
      console.log('✓ Campaign fields already exist in Call table');
    }

    // Verify all tables and columns were created
    console.log('\nVerifying database structure...');
    
    const campaignColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'Campaign'
      ORDER BY ordinal_position;
    `;

    console.log('\nCampaign table columns:');
    campaignColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const leadColumns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'CampaignLead'
      ORDER BY ordinal_position;
    `;

    console.log('\nCampaignLead table columns:');
    leadColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n========================================');
    console.log('Database update complete!');
    console.log('Run: npx prisma generate');
    console.log('========================================\n');

  } catch (error) {
    console.error('Database update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDatabase()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


