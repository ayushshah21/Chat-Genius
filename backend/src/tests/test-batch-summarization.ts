import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { contextService } from '../services/context.service';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { CHAT_MEMORY_TABLE } from '../config/dynamodb';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env.development');
console.log('Loading environment from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env.development:', result.error);
} else {
    console.log('Environment variables loaded successfully');
}

const prisma = new PrismaClient();
const dynamoDbClient = new DynamoDBClient({
    region: process.env.AWS_REGION
});

async function testBatchSummarization() {
    console.log('Starting batch summarization tests...');

    let testUser1, testUser2, testChannel;

    try {
        // Create test users
        testUser1 = await prisma.user.create({
            data: {
                email: `test${Date.now()}@example.com`,
                name: 'Alice Developer',
                password: 'password123'
            }
        });

        testUser2 = await prisma.user.create({
            data: {
                email: `test${Date.now() + 1}@example.com`,
                name: 'Bob Engineer',
                password: 'password123'
            }
        });

        // Create test channel
        testChannel = await prisma.channel.create({
            data: {
                name: 'Test Channel',
                type: 'PUBLIC',
                creator: {
                    connect: { id: testUser1.id }
                }
            }
        });

        // Create test messages about different topics
        const testMessages = [
            // Topic 1: Project Planning
            {
                content: "Let's plan out the new feature implementation.",
                userId: testUser1.id,
                channelId: testChannel.id,
                isAI: false
            },
            {
                content: "I think we should start with the database schema.",
                userId: testUser2.id,
                channelId: testChannel.id,
                isAI: false
            },
            {
                content: "Good point. We'll need to add new tables for user preferences.",
                userId: testUser1.id,
                channelId: testChannel.id,
                isAI: false
            },

            // Topic 2: Bug Discussion (30 minutes later)
            {
                content: "Hey, I found a critical bug in the auth system.",
                userId: testUser2.id,
                channelId: testChannel.id,
                createdAt: new Date(Date.now() + 30 * 60 * 1000),
                isAI: false
            },
            {
                content: "What's the issue?",
                userId: testUser1.id,
                channelId: testChannel.id,
                createdAt: new Date(Date.now() + 31 * 60 * 1000),
                isAI: false
            },
            {
                content: "Token validation is failing for some edge cases.",
                userId: testUser2.id,
                channelId: testChannel.id,
                createdAt: new Date(Date.now() + 32 * 60 * 1000),
                isAI: false
            }
        ];

        // Create messages in sequence
        for (const msg of testMessages) {
            await prisma.message.create({
                data: msg
            });
        }

        console.log('Test data created successfully');

        // Get messages and generate summaries
        const dbMessages = await prisma.message.findMany({
            where: { channelId: testChannel.id },
            include: { user: true },
            orderBy: { createdAt: 'asc' }
        });

        // Convert messages to the Message interface format
        const formattedMessages = dbMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            userId: msg.userId,
            user: { name: msg.user?.name },
            channelId: msg.channelId,
            createdAt: msg.createdAt,
            isAI: msg.isAI
        }));

        // Generate summaries using the context service's private method
        const topicSummaries = await (contextService as any).batchSummarizeMessages(formattedMessages);

        // Test batch summarization with the generated summaries
        await contextService.updateContextWithBatchSummaries(testChannel.id, 'channel', topicSummaries);
        console.log('Batch summarization completed');

        // Verify DynamoDB storage
        const command = new GetItemCommand({
            TableName: CHAT_MEMORY_TABLE,
            Key: {
                contextId: { S: testChannel.id },
                type: { S: 'channel' }
            }
        });

        const { Item } = await dynamoDbClient.send(command);
        console.log('Retrieved DynamoDB item:', JSON.stringify(Item, null, 2));

        if (!Item) {
            throw new Error('No summaries found in DynamoDB');
        }

        const summaries = Item.summaries?.L;
        if (!summaries) {
            throw new Error('No summaries array found in DynamoDB item');
        }

        console.log(`Found ${summaries.length} topic summaries`);
        summaries.forEach((summary: any, index: number) => {
            console.log(`\nTopic ${index + 1}:`);
            console.log('Topic:', summary.M.topic.S);
            console.log('Summary:', summary.M.summary.S);
            console.log('Message Count:', summary.M.messageCount.N);
        });

    } catch (error: any) {
        console.error('Error in batch summarization test:', error);
        throw error;
    } finally {
        // Cleanup
        if (testChannel) {
            await prisma.message.deleteMany({
                where: { channelId: testChannel.id }
            });
            await prisma.channel.delete({
                where: { id: testChannel.id }
            });
        }
        if (testUser1) {
            await prisma.user.delete({
                where: { id: testUser1.id }
            });
        }
        if (testUser2) {
            await prisma.user.delete({
                where: { id: testUser2.id }
            });
        }
        console.log('Test cleanup completed');
    }
}

// Run the test
testBatchSummarization()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    }); 