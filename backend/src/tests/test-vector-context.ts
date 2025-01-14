import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../services/prisma.service';
import { VectorService } from '../services/vector.service';
import * as dotenv from 'dotenv';
import { Document } from 'langchain/document';
import { VectorMetadata } from '../services/vector.service';

// Load environment variables from .env.development
dotenv.config({ path: '.env.development' });

async function testVectorStore() {
    console.log('Starting Vector Store Test...');

    // Initialize services
    const configService = new ConfigService();
    const prismaService = new PrismaService();
    const vectorService = new VectorService(configService, prismaService);

    try {
        // Initialize vector service
        console.log('Initializing vector service...');
        await vectorService.onModuleInit();
        console.log('✓ Vector service initialized');

        // Test 1: Store a new message
        const testMessage = {
            content: 'This is a test message about implementing RAG in our chat application.',
            metadata: {
                messageId: 'test-msg-1',
                userId: 'test-user-1',
                userName: 'Test User',
                channelId: 'test-channel',
                type: 'channel' as const,
                createdAt: new Date().toISOString(),
                isAI: false
            }
        };

        console.log('\nTest 1: Storing new message...');
        await vectorService.addDocuments([
            new Document({
                pageContent: testMessage.content,
                metadata: testMessage.metadata
            })
        ]);
        console.log('✓ Message stored successfully');

        // Verify the message was stored
        const verifyResults = await vectorService.queryVectors(testMessage.content, 1);
        console.log('Verification results:', JSON.stringify(verifyResults, null, 2));
        if (verifyResults.length === 0) {
            throw new Error('Failed to verify stored message');
        }
        console.log('✓ Storage verified with similarity score:', verifyResults[0].score);

        // Test 2: Add related message
        const relatedMessage = {
            content: 'We should consider using Pinecone for vector storage in our RAG implementation.',
            metadata: {
                messageId: 'test-msg-2',
                userId: 'test-user-2',
                userName: 'Another User',
                channelId: 'test-channel',
                type: 'channel' as const,
                createdAt: new Date().toISOString(),
                isAI: false
            }
        };

        console.log('\nTest 2: Adding related message...');
        await vectorService.addDocuments([
            new Document({
                pageContent: relatedMessage.content,
                metadata: relatedMessage.metadata
            })
        ]);
        console.log('✓ Related message stored successfully');

        // Test 3: Query for similar messages
        console.log('\nTest 3: Querying for messages about RAG...');
        const results = await vectorService.queryVectors('How can we implement RAG in our application?');
        console.log('Query results:', JSON.stringify(results, null, 2));
        console.log('✓ Query completed successfully');

        // Test 4: Add unrelated message
        const unrelatedMessage = {
            content: 'What time is the team meeting tomorrow?',
            metadata: {
                messageId: 'test-msg-3',
                userId: 'test-user-1',
                userName: 'Test User',
                channelId: 'test-channel',
                type: 'channel' as const,
                createdAt: new Date().toISOString(),
                isAI: false
            }
        };

        console.log('\nTest 4: Adding unrelated message...');
        await vectorService.addDocuments([
            new Document({
                pageContent: unrelatedMessage.content,
                metadata: unrelatedMessage.metadata
            })
        ]);
        console.log('✓ Unrelated message stored successfully');

        // Test 5: Get relevant context
        console.log('\nTest 5: Getting relevant context for RAG discussion...');
        const relevantContext = await vectorService.getRelevantContext(
            'Tell me about our RAG implementation plans',
            'test-user-1'
        );
        console.log('Relevant context:', JSON.stringify(relevantContext, null, 2));
        console.log('✓ Context retrieval successful');

        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error instanceof Error ? error.message : error);
        throw error;
    }
}

// Run the test
testVectorStore()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Test failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }); 