import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateDatabase() {
    console.log(`\n========================================`);
    console.log(`Adding email column to Contact table`);
    console.log(`========================================\n`);

    try {
        // ============ CHECK IF COLUMN EXISTS ============
        console.log('--- Checking for email column ---\n');

        const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Contact' AND column_name = 'email'
      ) as exists;
    `;

        if (!columnCheck[0].exists) {
            console.log('Adding email column to Contact table...');

            await prisma.$executeRaw`
        ALTER TABLE "Contact" 
        ADD COLUMN "email" TEXT;
      `;
            console.log('✓ Added email column');

        } else {
            console.log('✓ email column already exists');
        }

        // ============ VERIFICATION ============
        console.log('\n--- Verifying Changes ---\n');

        // Verify table structure
        const columns = await prisma.$queryRaw<Array<{
            column_name: string;
            data_type: string;
            is_nullable: string;
            column_default: string | null;
        }>>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Contact'
      ORDER BY ordinal_position;
    `;

        console.log('Contact table columns:');
        columns.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` (default: ${col.column_default})` : '';
            console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
        });

        console.log('\n========================================');
        console.log('Database update complete!');
        console.log('========================================\n');

    } catch (error) {
        console.error('\n❌ Error updating database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

updateDatabase()
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
