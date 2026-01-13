
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    try {
        const total = await prisma.dianInvoice.count();
        const downloaded = await prisma.dianInvoice.count({
            where: { isDownloaded: true }
        });

        console.log(`Total invoices: ${total}`);
        console.log(`Downloaded invoices: ${downloaded}`);

        if (downloaded > 0) {
            const sample = await prisma.dianInvoice.findFirst({
                where: { isDownloaded: true }
            });
            console.log('Sample downloaded invoice:', JSON.stringify(sample, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

main();
