import { VectorService } from '../services/vector.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../services/prisma.service';

async function inspectVectorStore() {
    console.log('Initializing vector service...');
    const configService = new ConfigService();
    const prismaService = new PrismaService();
    const vectorService = new VectorService(configService, prismaService);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('\nSearching for messages about "plantation" or "golf"...');
    const golfResults = await vectorService.queryVectors('plantation golf PGA course', { k: 20 });

    console.log('\nFound messages:');
    golfResults.forEach((result, index) => {
        console.log(`\n--- Result ${index + 1} (Score: ${result.score.toFixed(3)}) ---`);
        console.log('Content:', result.pageContent);
        console.log('Created:', new Date(result.metadata.createdAt).toLocaleString());
        console.log('User:', result.metadata.userName);
        console.log('Type:', result.metadata.type);
        console.log('Channel:', result.metadata.channelId);
    });

    // Clean up test data
    console.log('\nCleaning up test data...');
    await vectorService.deleteTestData();

    // Test basic retrieval
    console.log('\n[Test] Testing basic retrieval...');
    const results = await vectorService.queryVectors("What are the contents?", { k: 20 });

    // Test semantic search
    console.log('\n[Test] Testing semantic search...');
    const semanticResults = await vectorService.queryVectors("Tell me about security issues", { k: 5 });
}

inspectVectorStore().catch(console.error);