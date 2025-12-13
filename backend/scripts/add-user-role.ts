import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

async function updateDatabase() {
    console.log('\n========================================');
    console.log('Adding UserRole enum and role column to User table');
    console.log('========================================\n');

    try {
        // Check if UserRole enum exists
        console.log('Checking if UserRole enum exists...');
        const enumCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'UserRole'
      ) as exists;
    `;

        if (!enumCheck[0]?.exists) {
            console.log('Creating UserRole enum...');
            await prisma.$executeRaw`
        CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
      `;
            console.log('✓ Created UserRole enum');
        } else {
            console.log('✓ UserRole enum already exists');
        }

        // Check if role column exists
        console.log('Checking if role column exists...');
        const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'role'
      ) as exists;
    `;

        if (!columnCheck[0]?.exists) {
            console.log('Adding role column to User table...');
            await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
      `;
            console.log('✓ Added role column with default USER');
        } else {
            console.log('✓ role column already exists');
        }

        console.log('\nVerifying User table role column...');
        const columns = await prisma.$queryRaw<
            Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>
        >`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'role';
    `;

        if (columns.length > 0) {
            console.log('\nUser role column:');
            columns.forEach(col => {
                console.log(
                    `  - ${col.column_name}: ${col.data_type} ${col.is_nullable} default: ${col.column_default}`
                );
            });
        }

        console.log('\n========================================');
        console.log('Database update complete!');
        console.log('Run `npx prisma generate` to update the client.');
        console.log('========================================\n');
    } catch (error) {
        console.error('Database update failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

updateDatabase().catch(error => {
    console.error(error);
    process.exit(1);
});
