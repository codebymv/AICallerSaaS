import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
  console.log(`\n========================================`);
  console.log(`Adding Media Tool Fields to Database`);
  console.log(`========================================\n`);

  try {
    // ============================================
    // 1. Add AssetCategory enum
    // ============================================
    console.log('1. Checking AssetCategory enum...');
    const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'AssetCategory'
      ) as exists;
    `;

    if (!enumCheck[0].exists) {
      console.log('   Creating AssetCategory enum...');
      await prisma.$executeRaw`
        CREATE TYPE "AssetCategory" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'OTHER');
      `;
      console.log('   ✓ Created AssetCategory enum');
    } else {
      console.log('   ✓ AssetCategory enum already exists');
    }

    // ============================================
    // 2. Add imageToolEnabled column to Agent table
    // ============================================
    console.log('2. Checking imageToolEnabled column...');
    const imageToolCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'imageToolEnabled'
      ) as exists;
    `;

    if (!imageToolCheck[0].exists) {
      console.log('   Adding imageToolEnabled column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "imageToolEnabled" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('   ✓ Added imageToolEnabled column');
    } else {
      console.log('   ✓ imageToolEnabled column already exists');
    }

    // ============================================
    // 3. Add documentToolEnabled column to Agent table
    // ============================================
    console.log('3. Checking documentToolEnabled column...');
    const documentToolCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'documentToolEnabled'
      ) as exists;
    `;

    if (!documentToolCheck[0].exists) {
      console.log('   Adding documentToolEnabled column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "documentToolEnabled" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('   ✓ Added documentToolEnabled column');
    } else {
      console.log('   ✓ documentToolEnabled column already exists');
    }

    // ============================================
    // 4. Add videoToolEnabled column to Agent table
    // ============================================
    console.log('4. Checking videoToolEnabled column...');
    const videoToolCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Agent' AND column_name = 'videoToolEnabled'
      ) as exists;
    `;

    if (!videoToolCheck[0].exists) {
      console.log('   Adding videoToolEnabled column...');
      await prisma.$executeRaw`
        ALTER TABLE "Agent" 
        ADD COLUMN "videoToolEnabled" BOOLEAN NOT NULL DEFAULT false;
      `;
      console.log('   ✓ Added videoToolEnabled column');
    } else {
      console.log('   ✓ videoToolEnabled column already exists');
    }

    // ============================================
    // 5. Create Asset table
    // ============================================
    console.log('5. Checking Asset table...');
    const assetTableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Asset'
      ) as exists;
    `;

    if (!assetTableCheck[0].exists) {
      console.log('   Creating Asset table...');
      await prisma.$executeRaw`
        CREATE TABLE "Asset" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "agentId" TEXT,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "url" TEXT NOT NULL,
          "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
          "mimeType" TEXT,
          "fileSize" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
        );
      `;
      console.log('   ✓ Created Asset table');

      // Add foreign key constraint to User
      console.log('   Adding foreign key to User...');
      await prisma.$executeRaw`
        ALTER TABLE "Asset" 
        ADD CONSTRAINT "Asset_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `;
      console.log('   ✓ Added Asset -> User foreign key');

      // Add foreign key constraint to Agent (optional)
      console.log('   Adding foreign key to Agent...');
      await prisma.$executeRaw`
        ALTER TABLE "Asset" 
        ADD CONSTRAINT "Asset_agentId_fkey" 
        FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('   ✓ Added Asset -> Agent foreign key');

      // Create index on userId
      console.log('   Creating index on userId...');
      await prisma.$executeRaw`
        CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");
      `;
      console.log('   ✓ Created userId index');

      // Create index on agentId
      console.log('   Creating index on agentId...');
      await prisma.$executeRaw`
        CREATE INDEX "Asset_agentId_idx" ON "Asset"("agentId");
      `;
      console.log('   ✓ Created agentId index');

      // Create index on category
      console.log('   Creating index on category...');
      await prisma.$executeRaw`
        CREATE INDEX "Asset_category_idx" ON "Asset"("category");
      `;
      console.log('   ✓ Created category index');

    } else {
      // Asset table exists, check if agentId column needs to be added
      console.log('   ✓ Asset table already exists');
      
      const agentIdColCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Asset' AND column_name = 'agentId'
        ) as exists;
      `;
      
      if (!agentIdColCheck[0].exists) {
        console.log('   Adding agentId column to Asset...');
        await prisma.$executeRaw`
          ALTER TABLE "Asset" 
          ADD COLUMN "agentId" TEXT;
        `;
        await prisma.$executeRaw`
          ALTER TABLE "Asset" 
          ADD CONSTRAINT "Asset_agentId_fkey" 
          FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        `;
        await prisma.$executeRaw`
          CREATE INDEX "Asset_agentId_idx" ON "Asset"("agentId");
        `;
        console.log('   ✓ Added agentId column with foreign key');
      } else {
        console.log('   ✓ agentId column already exists');
      }
    }

    // ============================================
    // Summary
    // ============================================
    console.log(`\n========================================`);
    console.log(`Migration Complete!`);
    console.log(`========================================`);
    console.log(`
Added the following to support tool-based media:

Agent table:
  - imageToolEnabled (Boolean, default false)
  - documentToolEnabled (Boolean, default false) 
  - videoToolEnabled (Boolean, default false)

New tables:
  - Asset (for storing pre-uploaded media references)

New enums:
  - AssetCategory (IMAGE, DOCUMENT, VIDEO, OTHER)

Next steps:
  1. Run: npx prisma generate
  2. Restart the backend server
`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
