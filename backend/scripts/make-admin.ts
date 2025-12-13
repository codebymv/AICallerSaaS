import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

// Get email from command line argument
const emailToMakeAdmin = process.argv[2];

async function makeAdmin() {
    console.log('\n========================================');
    console.log('Make User Admin');
    console.log('========================================\n');

    if (!emailToMakeAdmin) {
        console.error('Usage: npx ts-node scripts/make-admin.ts <email>');
        console.error('Example: npx ts-node scripts/make-admin.ts admin@example.com');
        process.exit(1);
    }

    try {
        console.log(`Looking up user: ${emailToMakeAdmin}`);

        const user = await prisma.user.findUnique({
            where: { email: emailToMakeAdmin },
        });

        if (!user) {
            console.error(`User not found: ${emailToMakeAdmin}`);
            process.exit(1);
            return; // TypeScript flow analysis
        }

        console.log(`Found user: ${user.name || user.email}`);
        console.log(`Current role: ${user.role || 'USER (not set)'}`);

        if (user.role === 'ADMIN') {
            console.log('\n✓ User is already an admin!');
            return;
        }

        console.log('\nUpdating role to ADMIN...');
        await prisma.$executeRaw`
      UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = ${emailToMakeAdmin};
    `;

        console.log('✓ User is now an admin!');
        console.log('\n========================================');
        console.log('Done! User will have admin access on next login.');
        console.log('========================================\n');
    } catch (error) {
        console.error('Failed to make user admin:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

makeAdmin().catch(error => {
    console.error(error);
    process.exit(1);
});
