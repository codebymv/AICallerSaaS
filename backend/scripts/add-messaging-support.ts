import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Messaging Support to Database`);
  console.log(`========================================\n`);

  try {
    // ============================================
    // 1. Add CommunicationChannel enum
    // ============================================
    console.log('1. Checking CommunicationChannel enum...');
    const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'CommunicationChannel'
      ) as exists;
    `;

    if (!enumCheck[0].exists) {
      console.log('   Creating CommunicationChannel enum...');
      await prisma.$executeRaw`
        CREATE TYPE "CommunicationChannel" AS ENUM ('VOICE_ONLY', 'MESSAGING_ONLY', 'OMNICHANNEL');
      `;
      console.log('   ✓ Created CommunicationChannel enum');
    } else {
      console.log('   ✓ CommunicationChannel enum already exists');
    }

    // ============================================
    // 2. Add MessageType enum
    // ============================================
    console.log('2. Checking MessageType enum...');
    const messageTypeCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'MessageType'
      ) as exists;
    `;

    if (!messageTypeCheck[0].exists) {
      console.log('   Creating MessageType enum...');
      await prisma.$executeRaw`
        CREATE TYPE "MessageType" AS ENUM ('SMS', 'MMS');
      `;
      console.log('   ✓ Created MessageType enum');
    } else {
      console.log('   ✓ MessageType enum already exists');
    }

    // ============================================
    // 3. Add MessageDirection enum
    // ============================================
    console.log('3. Checking MessageDirection enum...');
    const messageDirectionCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'MessageDirection'
      ) as exists;
    `;

    if (!messageDirectionCheck[0].exists) {
      console.log('   Creating MessageDirection enum...');
      await prisma.$executeRaw`
        CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
      `;
      console.log('   ✓ Created MessageDirection enum');
    } else {
      console.log('   ✓ MessageDirection enum already exists');
    }

    // ============================================
    // 4. Add MessageStatus enum
    // ============================================
    console.log('4. Checking MessageStatus enum...');
    const messageStatusCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'MessageStatus'
      ) as exists;
    `;

    if (!messageStatusCheck[0].exists) {
      console.log('   Creating MessageStatus enum...');
      await prisma.$executeRaw`
        CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'RECEIVED');
      `;
      console.log('   ✓ Created MessageStatus enum');
    } else {
      console.log('   ✓ MessageStatus enum already exists');
    }

    // ============================================
    // 5. Add messaging columns to Agent table
    // ============================================
    console.log('5. Checking Agent table messaging columns...');
    
    // communicationChannel
    const channelColCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'communicationChannel'
      ) as exists;
    `;

    if (!channelColCheck[0].exists) {
      console.log('   Adding communicationChannel column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "communicationChannel" "CommunicationChannel" NOT NULL DEFAULT 'VOICE_ONLY';
      `;
      console.log('   ✓ Added communicationChannel column');
    } else {
      console.log('   ✓ communicationChannel column already exists');
    }

    // messagingGreeting
    const msgGreetingCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'messagingGreeting'
      ) as exists;
    `;

    if (!msgGreetingCheck[0].exists) {
      console.log('   Adding messagingGreeting column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "messagingGreeting" TEXT;
      `;
      console.log('   ✓ Added messagingGreeting column');
    } else {
      console.log('   ✓ messagingGreeting column already exists');
    }

    // messagingSystemPrompt
    const msgPromptCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'messagingSystemPrompt'
      ) as exists;
    `;

    if (!msgPromptCheck[0].exists) {
      console.log('   Adding messagingSystemPrompt column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "messagingSystemPrompt" TEXT;
      `;
      console.log('   ✓ Added messagingSystemPrompt column');
    } else {
      console.log('   ✓ messagingSystemPrompt column already exists');
    }

    // mmsEnabled
    const mmsEnabledCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'mmsEnabled'
      ) as exists;
    `;

    if (!mmsEnabledCheck[0].exists) {
      console.log('   Adding mmsEnabled column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "mmsEnabled" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('   ✓ Added mmsEnabled column');
    } else {
      console.log('   ✓ mmsEnabled column already exists');
    }

    // ============================================
    // 6. Create Message table
    // ============================================
    console.log('6. Checking Message table...');
    const messageTableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Message'
      ) as exists;
    `;

    if (!messageTableCheck[0].exists) {
      console.log('   Creating Message table...');
      await prisma.$executeRaw`
        CREATE TABLE "Message" (
          "id" TEXT NOT NULL,
          "messageSid" TEXT NOT NULL,
          "type" "MessageType" NOT NULL DEFAULT 'SMS',
          "direction" "MessageDirection" NOT NULL,
          "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
          "from" TEXT NOT NULL,
          "to" TEXT NOT NULL,
          "body" TEXT,
          "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "mediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "numMedia" INTEGER NOT NULL DEFAULT 0,
          "sentAt" TIMESTAMP(3),
          "deliveredAt" TIMESTAMP(3),
          "costUsd" DECIMAL(10,4),
          "numSegments" INTEGER NOT NULL DEFAULT 1,
          "conversationId" TEXT,
          "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
          "errorCode" TEXT,
          "errorMessage" TEXT,
          "metadata" JSONB,
          "agentName" TEXT,
          "agentSystemPrompt" TEXT,
          "userId" TEXT NOT NULL,
          "agentId" TEXT,
          "phoneNumberId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          
          CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('   ✓ Created Message table');

      // Add unique constraint on messageSid
      await prisma.$executeRaw`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_messageSid_key" UNIQUE ("messageSid");
      `;
      console.log('   ✓ Added unique constraint on messageSid');

      // Add foreign keys
      await prisma.$executeRaw`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      await prisma.$executeRaw`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" 
        FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      await prisma.$executeRaw`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_phoneNumberId_fkey" 
        FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('   ✓ Added foreign key constraints');

      // Add indexes
      await prisma.$executeRaw`CREATE INDEX "Message_userId_createdAt_idx" ON "Message"("userId", "createdAt");`;
      await prisma.$executeRaw`CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");`;
      await prisma.$executeRaw`CREATE INDEX "Message_agentId_idx" ON "Message"("agentId");`;
      await prisma.$executeRaw`CREATE INDEX "Message_status_idx" ON "Message"("status");`;
      await prisma.$executeRaw`CREATE INDEX "Message_messageSid_idx" ON "Message"("messageSid");`;
      await prisma.$executeRaw`CREATE INDEX "Message_from_to_idx" ON "Message"("from", "to");`;
      console.log('   ✓ Added indexes');
    } else {
      console.log('   ✓ Message table already exists');
    }

    // ============================================
    // 7. Create Conversation table
    // ============================================
    console.log('7. Checking Conversation table...');
    const conversationTableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Conversation'
      ) as exists;
    `;

    if (!conversationTableCheck[0].exists) {
      console.log('   Creating Conversation table...');
      await prisma.$executeRaw`
        CREATE TABLE "Conversation" (
          "id" TEXT NOT NULL,
          "externalNumber" TEXT NOT NULL,
          "twilioNumber" TEXT NOT NULL,
          "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "messageCount" INTEGER NOT NULL DEFAULT 0,
          "conversationHistory" JSONB,
          "userId" TEXT NOT NULL,
          "agentId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          
          CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('   ✓ Created Conversation table');

      // Add unique constraint
      await prisma.$executeRaw`
        ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_externalNumber_twilioNumber_key" 
        UNIQUE ("userId", "externalNumber", "twilioNumber");
      `;
      console.log('   ✓ Added unique constraint');

      // Add foreign keys
      await prisma.$executeRaw`
        ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      await prisma.$executeRaw`
        ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentId_fkey" 
        FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('   ✓ Added foreign key constraints');

      // Add indexes
      await prisma.$executeRaw`CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");`;
      await prisma.$executeRaw`CREATE INDEX "Conversation_agentId_idx" ON "Conversation"("agentId");`;
      await prisma.$executeRaw`CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");`;
      console.log('   ✓ Added indexes');

      // Add foreign key from Message to Conversation
      await prisma.$executeRaw`
        ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" 
        FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('   ✓ Added Message->Conversation foreign key');
    } else {
      console.log('   ✓ Conversation table already exists');
    }

    // ============================================
    // 8. Add index on Agent.communicationChannel
    // ============================================
    console.log('8. Checking Agent.communicationChannel index...');
    const indexCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'Agent_communicationChannel_idx'
      ) as exists;
    `;

    if (!indexCheck[0].exists) {
      console.log('   Adding index on communicationChannel...');
      await prisma.$executeRaw`
        CREATE INDEX "Agent_communicationChannel_idx" ON "Agent"("communicationChannel");
      `;
      console.log('   ✓ Added communicationChannel index');
    } else {
      console.log('   ✓ communicationChannel index already exists');
    }

    // ============================================
    // Verify changes
    // ============================================
    console.log('\n========================================');
    console.log('Verifying database changes...');
    console.log('========================================\n');

    // Check Agent columns
    const agentCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'Agent' 
      AND column_name IN ('communicationChannel', 'messagingGreeting', 'messagingSystemPrompt', 'mmsEnabled')
      ORDER BY column_name;
    `;
    console.log('Agent messaging columns:');
    agentCols.forEach(col => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type}`);
    });

    // Check Message table
    const messageCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Message'
      ORDER BY ordinal_position;
    `;
    console.log(`\nMessage table columns (${messageCols.length} total):`);
    console.log(`  ✓ ${messageCols.map(c => c.column_name).join(', ')}`);

    // Check Conversation table
    const convCols = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Conversation'
      ORDER BY ordinal_position;
    `;
    console.log(`\nConversation table columns (${convCols.length} total):`);
    console.log(`  ✓ ${convCols.map(c => c.column_name).join(', ')}`);

    console.log('\n========================================');
    console.log('✅ Database update complete!');
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('  1. Run: cd backend && npx prisma generate');
    console.log('  2. Restart your backend server');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Database update failed:', error);
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
