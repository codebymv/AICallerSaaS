/**
 * Backfill script to create Conversation records for existing Messages
 * that don't have a conversationId.
 * 
 * Run with: npx ts-node scripts/backfill-conversations.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillConversations() {
  console.log('Starting conversation backfill...');

  // Find all messages without a conversation
  const messagesWithoutConversation = await prisma.message.findMany({
    where: {
      conversationId: null,
    },
    select: {
      id: true,
      userId: true,
      agentId: true,
      from: true,
      to: true,
      direction: true,
      createdAt: true,
    },
  });

  console.log(`Found ${messagesWithoutConversation.length} messages without conversations`);

  // Group messages by unique conversation key (userId + externalNumber + twilioNumber)
  const conversationGroups = new Map<string, typeof messagesWithoutConversation>();
  
  for (const message of messagesWithoutConversation) {
    // Determine external number and twilio number based on direction
    const externalNumber = message.direction === 'INBOUND' ? message.from : message.to;
    const twilioNumber = message.direction === 'INBOUND' ? message.to : message.from;
    
    const key = `${message.userId}|${externalNumber}|${twilioNumber}`;
    
    if (!conversationGroups.has(key)) {
      conversationGroups.set(key, []);
    }
    conversationGroups.get(key)!.push(message);
  }

  console.log(`Grouped into ${conversationGroups.size} unique conversations`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [key, messages] of conversationGroups) {
    const [userId, externalNumber, twilioNumber] = key.split('|');
    
    // Sort by createdAt to get the most recent
    messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const mostRecentMessage = messages[0];
    
    try {
      // Upsert the conversation
      const conversation = await prisma.conversation.upsert({
        where: {
          userId_externalNumber_twilioNumber: {
            userId,
            externalNumber,
            twilioNumber,
          },
        },
        update: {
          messageCount: { increment: messages.length },
          lastMessageAt: mostRecentMessage.createdAt,
          agentId: mostRecentMessage.agentId,
        },
        create: {
          userId,
          externalNumber,
          twilioNumber,
          agentId: mostRecentMessage.agentId,
          lastMessageAt: mostRecentMessage.createdAt,
          messageCount: messages.length,
        },
      });

      created++;

      // Update all messages in this group to link to the conversation
      const messageIds = messages.map(m => m.id);
      await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
        },
        data: {
          conversationId: conversation.id,
        },
      });

      updated += messages.length;
      
      console.log(`✓ Created/updated conversation for ${externalNumber} <-> ${twilioNumber} (${messages.length} messages)`);
    } catch (error) {
      console.error(`✗ Error processing conversation ${key}:`, error);
      errors++;
    }
  }

  console.log('\n--- Backfill Complete ---');
  console.log(`Conversations created/updated: ${created}`);
  console.log(`Messages updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  await prisma.$disconnect();
}

backfillConversations().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
