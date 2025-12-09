import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating agents without mode...');
  
  // Update all agents that don't have a mode set
  const result = await prisma.agent.updateMany({
    where: {
      OR: [
        { mode: null },
        // @ts-ignore - mode might not exist on older records
        { mode: undefined }
      ]
    },
    data: {
      mode: 'INBOUND', // Set default mode to INBOUND
    },
  });

  console.log(`Updated ${result.count} agents to INBOUND mode`);
  
  // List all agents with their modes
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      name: true,
      mode: true,
    },
  });

  console.log('\nCurrent agents:');
  agents.forEach(agent => {
    console.log(`- ${agent.name}: ${agent.mode}`);
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

