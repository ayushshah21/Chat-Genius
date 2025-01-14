import { VectorService } from '../services/vector.service';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testPineconeContents() {
    console.log('[PineconeTest] Starting Pinecone content inspection...');

    try {
        // Initialize services
        const configService = new ConfigService();
        const prismaService = new PrismaService();
        const vectorService = new VectorService(configService, prismaService);

        // Initialize vector store
        await vectorService.onModuleInit();

        // First, let's see what's in Pinecone before deletion
        console.log('\n[PineconeTest] Checking current Pinecone contents...');
        const initialResults = await vectorService.queryVectors('test message', 20);
        console.log('[PineconeTest] Current test messages:', initialResults.length);

        // Delete test data using metadata filter
        console.log('\n[PineconeTest] Cleaning up test data...');
        await vectorService.deleteTestData();
        console.log('[PineconeTest] Test data cleanup completed');

        // Check sync status between database and Pinecone
        console.log('\n[PineconeTest] Checking sync status...');
        const dbMessages = await prismaService.message.findMany({
            where: {
                content: { not: null },
                channelId: { not: undefined }
            },
            include: {
                user: true,
                channel: true
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });

        console.log(`[PineconeTest] Recent messages in database: ${dbMessages.length}`);

        // Check each message in Pinecone
        console.log('\n[PineconeTest] Checking if recent messages are in Pinecone...');
        let missingCount = 0;

        for (const msg of dbMessages) {
            if (!msg.content) continue;

            const searchResult = await vectorService.queryVectors(msg.content, 5);
            const found = searchResult.some(result => result.metadata.messageId === msg.id);

            console.log(`Message "${msg.content.substring(0, 30)}..." (${msg.id}): ${found ? 'Found in Pinecone' : 'Not found in Pinecone'}`);

            if (!found) missingCount++;
        }

        // If messages are missing, trigger a full sync
        if (missingCount > 0) {
            console.log(`\n[PineconeTest] Found ${missingCount} messages missing from Pinecone`);
            console.log('[PineconeTest] Starting full sync...');
            await vectorService.forceFullSync();
        }

        // Clean up
        await prismaService.$disconnect();
        console.log('\n[PineconeTest] Test completed successfully');

    } catch (error) {
        console.error('[PineconeTest] Error during test:', error);
        process.exit(1);
    }
}

// Run the test
testPineconeContents().catch(console.error); 